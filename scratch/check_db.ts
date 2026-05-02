
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  const { data: coaches, error: coachError } = await supabase.from('coaches').select('id, user_id');
  console.log('COACHES:', coaches);
  
  const { data: links, error: linkError } = await supabase.from('coach_client_links').select('*');
  console.log('LINKS:', links);
  
  const { data: clients, error: clientError } = await supabase.from('clients').select('id, user_id');
  console.log('CLIENTS:', clients);
}

checkDb();
