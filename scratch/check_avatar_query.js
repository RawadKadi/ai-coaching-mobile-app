const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: clients, error: clientErr } = await supabase.from('clients').select('id, user_id').limit(5);
  console.log('Clients count:', clients?.length);
  if (clientErr || !clients || !clients.length) {
    console.error('No clients found or error:', clientErr);
    return;
  }
  
  for (const client of clients) {
    console.log('Client:', client);
    const { data: profile1, error: err1 } = await supabase
      .from('clients')
      .select('*, profiles(*)')
      .eq('id', client.id)
      .single();
    console.log('profiles relation query:', profile1?.profiles, 'Error:', err1?.message);

    const { data: profile2, error: err2 } = await supabase
      .from('profiles')
      .select('email, avatar_url')
      .eq('id', client.user_id)
      .single();
    console.log('profiles direct query:', profile2, 'Error:', err2?.message);
  }
}

run();
