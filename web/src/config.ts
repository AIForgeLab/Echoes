const env = import.meta.env

export const SUPABASE_URL: string | undefined = env.VITE_SUPABASE_URL || undefined
export const SUPABASE_ANON_KEY: string | undefined = env.VITE_SUPABASE_ANON_KEY || undefined

/** Demo mode is on when asked for, or when Supabase isn't configured. */
export const DEMO_MODE: boolean = env.VITE_DEMO_MODE === 'true' || !SUPABASE_URL || !SUPABASE_ANON_KEY

/** The Echoes AI server (api/app.py). Holds the Gemini key; the browser never sees it. */
export const API_URL: string | undefined = env.VITE_API_URL || undefined

export const APP_VERSION = '1.0.0'
