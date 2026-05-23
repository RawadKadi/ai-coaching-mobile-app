const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching coach_client_links...');
  const { data: links, error: linksError } = await supabase
    .from('coach_client_links')
    .select('*');
  
  if (linksError) {
    console.error('Error fetching links:', linksError);
  } else {
    console.log('Links:', links);
  }

  console.log('Fetching coaches...');
  const { data: coaches, error: coachesError } = await supabase
    .from('coaches')
    .select('id, user_id');
  if (coachesError) console.error('Error fetching coaches:', coachesError);
  else console.log('Coaches:', coaches);

  console.log('Fetching clients...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, user_id');
  if (clientsError) console.error('Error fetching clients:', clientsError);
  else console.log('Clients:', clients);

  console.log('Fetching profiles...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, role');
  if (profilesError) console.error('Error fetching profiles:', profilesError);
  else console.log('Profiles:', profiles);
}

run();
