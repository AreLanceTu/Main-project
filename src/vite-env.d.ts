/// <reference types="vite/client" />

interface Window {
	Razorpay?: any;
}

interface ImportMetaEnv {
	readonly VITE_SUPABASE_FUNCTIONS_URL?: string;
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
	readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
