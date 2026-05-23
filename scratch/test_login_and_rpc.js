const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWithEmail(email, password) {
  console.log(`\n--- Testing authentication for ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.log(`Failed to log in as ${email}:`, authError.message);
    return false;
  }

  console.log(`Logged in successfully as ${email}! User ID:`, authData.user.id);

  // Now query coach
  const { data: coaches, error: coachError } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', authData.user.id)
    .limit(1);

  if (coachError) {
    console.error('Coach fetch error:', coachError);
    return false;
  }
  if (!coaches || coaches.length === 0) {
    console.error('No coach record found for user');
    return false;
  }
  const coachId = coaches[0].id;
  console.log('Coach ID:', coachId);

  // Fetch active links
  const { data: links, error: linkError } = await supabase
    .from('coach_client_links')
    .select('client_id, client:clients(profiles(full_name))')
    .eq('coach_id', coachId)
    .eq('status', 'active');

  if (linkError) {
    console.error('Link fetch error:', linkError);
    return false;
  }
  
  console.log(`Found ${links.length} active client links:`);
  links.forEach(l => {
    console.log(` - Client ID: ${l.client_id}, Name: ${l.client?.profiles?.full_name}`);
  });

  if (links.length === 0) {
    console.log('Cannot test RPC without active client links.');
    return true;
  }

  const clientId = links[0].client_id;
  console.log('Testing RPC for client:', clientId);

  const testSubChallenges = [
    {
      name: 'Test Task 1',
      description: 'Description 1',
      assigned_date: new Date().toISOString().split('T')[0],
      focus_type: 'training',
      intensity: 'medium'
    }
  ];

  console.log('Calling create_mother_challenge...');
  console.time('RPC duration');
  const { data, error } = await supabase.rpc('create_mother_challenge', {
    p_coach_id: coachId,
    p_client_id: clientId,
    p_name: 'Test Plan from Script',
    p_description: 'Test Description',
    p_start_date: new Date().toISOString().split('T')[0],
    p_end_date: new Date().toISOString().split('T')[0],
    p_sub_challenges: testSubChallenges,
    p_created_by: 'coach',
    p_mode: 'relative'
  });
  console.timeEnd('RPC duration');

  console.log('RPC result:', { data, error });
  return true;
}

async function run() {
  // Let's try some common credentials
  let success = await testWithEmail('coach@test.com', 'password123');
  if (!success) {
    // Try the user's specific email if we can guess or if they signed up
    success = await testWithEmail('rawad182002@hotmail.com', 'password123');
  }
  if (!success) {
    success = await testWithEmail('rawad182002@hotmail.com', 'test123');
  }
}

run();
