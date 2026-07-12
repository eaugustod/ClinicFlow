import { createClient } from '@supabase/supabase-js';

const SB_URL = localStorage.getItem('cf_supa_url') || import.meta.env.VITE_SUPABASE_URL || "https://ezkfnbrlqnruymhhfeei.supabase.co";
const SB_KEY = localStorage.getItem('cf_supa_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2ZuYnJscW5ydXltaGhmZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg1MzAsImV4cCI6MjA5MDgwNDUzMH0.llrWSk5Kz-UvTPWY5fpeO7QD-aFaobcvAP9FxH8PhB4";

export const supabase = createClient(SB_URL, SB_KEY);
