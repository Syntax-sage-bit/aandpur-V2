const SUPABASE_URL = "https://enqbozewsiystfoannse.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hboj2trEOsKC_v5vupFL4Q_Qba1s4If";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);