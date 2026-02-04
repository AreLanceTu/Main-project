export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-firebase-token, x-client-info, apikey, content-type, x-razorpay-signature, x-file-name",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

export function withCors(headers: HeadersInit = {}): HeadersInit {
  return { ...corsHeaders, ...headers };
}
