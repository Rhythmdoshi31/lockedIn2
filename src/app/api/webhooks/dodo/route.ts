import { NextResponse } from "next/server";
import type { Payment } from "dodopayments/resources/payments";
import type { Subscription } from "dodopayments/resources/subscriptions";

import { createDodoClient } from "@/lib/dodo";
import { creditsForPayment, webhookIdentity, type DodoPlan } from "@/lib/dodo-webhook-policy";
import { pipelineLog } from "@/lib/pipeline-log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENTS = new Set(["subscription.active", "subscription.renewed", "subscription.cancelled", "subscription.on_hold", "subscription.failed", "subscription.expired"]);

class WebhookInputError extends Error {}

function requiredConfiguration() {
  const values = {apiKey:process.env.DODO_PAYMENTS_API_KEY,webhookKey:process.env.DODO_PAYMENTS_WEBHOOK_KEY,starterProductId:process.env.DODO_PAYMENTS_STARTER_PRODUCT_ID,premiumProductId:process.env.DODO_PAYMENTS_PREMIUM_PRODUCT_ID,supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,supabaseSecret:process.env.SUPABASE_SECRET_KEY};
  return {values,missing:Object.entries(values).filter(([,value])=>!value).map(([name])=>name)};
}

function identityFromMetadata(metadata:Record<string,unknown>){
  const identity=webhookIdentity(metadata);if(!identity)throw new WebhookInputError("Invalid user or plan metadata.");return identity;
}

function eventTimestamp(value:string){const parsed=new Date(value);if(!value||Number.isNaN(parsed.getTime()))throw new WebhookInputError("Invalid event timestamp.");return parsed.toISOString();}
function subscriptionIdFor(payment:Payment){if(payment.subscription_id)return payment.subscription_id;return payment.subscription_ids.length===1?payment.subscription_ids[0]:null;}

async function paymentProduct(payment:Payment,plan:DodoPlan,userId:string,starterProductId:string,premiumProductId:string){
  if(plan==="starter"){
    const matches=payment.product_cart?.filter((item)=>item.product_id===starterProductId)??[];
    if(matches.length!==1||payment.product_cart?.length!==1||matches[0].quantity!==1)throw new WebhookInputError("Payment product does not match Starter.");
    return {productId:starterProductId,subscriptionId:null,entitlementEndsAt:null};
  }
  const subscriptionId=subscriptionIdFor(payment);if(!subscriptionId)throw new WebhookInputError("Premium payment has no single subscription.");
  const subscription=await createDodoClient().subscriptions.retrieve(subscriptionId);
  const subscriptionIdentity=webhookIdentity(subscription.metadata);
  if(subscription.product_id!==premiumProductId||subscriptionIdentity?.userId!==userId||subscriptionIdentity.plan!=="premium")throw new WebhookInputError("Payment product or subscription metadata does not match Premium.");
  const entitlementEndsAt=payment.service_periods.find((period)=>period.subscription_id===subscriptionId)?.ends_at??null;
  return {productId:premiumProductId,subscriptionId,entitlementEndsAt};
}

function processingFailure(eventId:string,error:unknown){pipelineLog({requestId:eventId,stage:"dodo.webhook.processing",event:"webhook_processing",status:"failed",error});return NextResponse.json({error:"Webhook processing failed"},{status:500});}

export async function POST(request:Request){
  const {values,missing}=requiredConfiguration();
  if(missing.length){pipelineLog({requestId:request.headers.get("webhook-id")||crypto.randomUUID(),stage:"dodo.webhook.configuration",event:"environment_validation",status:"failed",details:{missing:missing.join(",")}});return NextResponse.json({error:"Webhook server configuration is incomplete"},{status:503});}
  const raw=await request.text();let event:ReturnType<ReturnType<typeof createDodoClient>["webhooks"]["unsafeUnwrap"]>;
  try{event=createDodoClient().webhooks.unwrap(raw,{headers:Object.fromEntries(request.headers.entries()),key:values.webhookKey!});}catch{return NextResponse.json({error:"Invalid signature"},{status:400});}
  const eventId=request.headers.get("webhook-id");if(!eventId)return NextResponse.json({error:"Missing event id"},{status:400});
  try{
    const admin=createAdminClient();const timestamp=eventTimestamp(event.timestamp);
    if(event.type==="payment.succeeded"||event.type==="payment.failed"){
      const payment=event.data;const {userId,plan}=identityFromMetadata(payment.metadata);const product=await paymentProduct(payment,plan,userId,values.starterProductId!,values.premiumProductId!);const succeeded=event.type==="payment.succeeded";
      const {data,error}=await admin.rpc("process_dodo_payment_webhook",{p_event_id:eventId,p_event_type:event.type,p_event_at:timestamp,p_payload:event,p_user:userId,p_plan:plan,p_payment_id:payment.payment_id,p_product_id:product.productId,p_amount:payment.total_amount,p_currency:payment.currency,p_status:succeeded?"succeeded":"failed",p_credits:creditsForPayment(plan,succeeded),p_subscription_id:product.subscriptionId,p_entitlement_ends_at:product.entitlementEndsAt,p_error_code:succeeded?null:payment.error_code??null,p_error_message:succeeded?null:payment.error_message??null});
      if(error)throw error;return NextResponse.json({received:true,status:(data as {status?:string}|null)?.status??"processed"});
    }
    if(SUBSCRIPTION_EVENTS.has(event.type)){
      const subscription=event.data as Subscription;const {userId,plan}=identityFromMetadata(subscription.metadata);
      if(plan!=="premium"||subscription.product_id!==values.premiumProductId)throw new WebhookInputError("Subscription metadata or product does not match Premium.");
      const {data,error}=await admin.rpc("process_dodo_subscription_webhook",{p_event_id:eventId,p_event_type:event.type,p_event_at:timestamp,p_payload:event,p_user:userId,p_subscription_id:subscription.subscription_id,p_product_id:subscription.product_id,p_status:subscription.status,p_cancel_at_next_billing_date:subscription.cancel_at_next_billing_date,p_next_billing_date:subscription.next_billing_date});
      if(error)throw error;return NextResponse.json({received:true,status:(data as {status?:string}|null)?.status??"processed"});
    }
    return NextResponse.json({received:true,ignored:true});
  }catch(error){if(error instanceof WebhookInputError){pipelineLog({requestId:eventId,stage:"dodo.webhook.validation",event:"webhook_validation",status:"rejected",error});return NextResponse.json({error:error.message},{status:400});}return processingFailure(eventId,error);}
}
