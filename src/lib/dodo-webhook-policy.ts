export type DodoPlan = "starter" | "premium";

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function webhookIdentity(metadata: Record<string, unknown>): {userId:string;plan:DodoPlan} | null {
  const userId=String(metadata.lockedin_user_id??"");
  const plan=String(metadata.lockedin_plan??"");
  return USER_ID_PATTERN.test(userId)&&(plan==="starter"||plan==="premium")?{userId,plan}:null;
}

export function creditsForPayment(plan:DodoPlan,succeeded:boolean):number {
  if(!succeeded)return 0;
  return plan==="premium"?80:10;
}

export function shouldApplyProviderEvent(existingTimestamp:string|null,incomingTimestamp:string):boolean {
  return existingTimestamp===null||new Date(incomingTimestamp).getTime()>new Date(existingTimestamp).getTime();
}
