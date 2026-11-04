import DodoPayments from "dodopayments";
export function createDodoClient(){const key=process.env.DODO_PAYMENTS_API_KEY;if(!key)throw new Error("Dodo Payments API key is missing.");return new DodoPayments({bearerToken:key,environment:process.env.DODO_PAYMENTS_ENVIRONMENT==="live_mode"?"live_mode":"test_mode"});}
