import { createClient } from "@supabase/supabase-js";

// since supabase has RLS, im allowing public to know url and key
// alternatively could run upload though a next function, but can have upload limit issues

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME || "";
