const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching coach...');
  const { data: coaches, error: coachError } = await supabase.from('coaches').select('id').limit(1);
  if (coachError) {
    console.error('Coach fetch error:', coachError);
    return;
  }
  if (!coaches || coaches.length === 0) {
    console.error('No coaches found in DB');
    return;
  }
  const coachId = coaches[0].id;
  console.log('Coach ID:', coachId);

  console.log('Fetching client link...');
  const { data: links, error: linkError } = await supabase
    .from('coach_client_links')
    .select('client_id, client:clients(profiles(full_name))')
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .limit(1);

  if (linkError) {
    console.error('Link fetch error:', linkError);
    return;
  }
  if (!links || links.length === 0) {
    console.error('No active links found for coach', coachId);
    return;
  }
  const clientId = links[0].client_id;
  console.log('Client ID:', clientId, 'Name:', links[0].client?.profiles?.full_name);

  console.log('Testing create_mother_challenge RPC...');
  const testSubChallenges = [
    {
      name: 'Test Task 1',
      description: 'Description 1',
      assigned_date: new Date().toISOString().split('T')[0],
      focus_type: 'training',
      intensity: 'medium'
    }
  ];

  console.time('RPC duration');
  const { data, error } = await supabase.rpc('create_mother_challenge', {
    p_coach_id: coachId,
    p_client_id: clientId,
    p_name: 'Test Plan',
    p_description: 'Test Description',
    p_start_date: new Date().toISOString().split('T')[0],
    p_end_date: new Date().toISOString().split('T')[0],
    p_sub_challenges: testSubChallenges,
    p_created_by: 'coach',
    p_mode: 'relative'
  });
  console.timeEnd('RPC duration');

  console.log('RPC result:', { data, error });
}

run();
