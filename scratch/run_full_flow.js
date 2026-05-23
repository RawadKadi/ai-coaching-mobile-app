const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const randomId = Math.floor(Math.random() * 1000000);
const coachEmail = `test_coach_${randomId}@example.com`;
const clientEmail = `test_client_${randomId}@example.com`;
const password = 'Password123!';

async function run() {
  console.log('1. Signing up coach...');
  const supabaseCoach = createClient(supabaseUrl, supabaseKey);
  const { data: coachAuth, error: coachAuthError } = await supabaseCoach.auth.signUp({
    email: coachEmail,
    password,
    options: {
      data: {
        full_name: 'Auto Test Coach',
        role: 'coach'
      }
    }
  });

  if (coachAuthError) {
    console.error('Coach signup failed:', coachAuthError.message);
    return;
  }
  console.log('Coach signed up successfully. User ID:', coachAuth.user.id);

  // Wait 1.5 seconds for triggers to run and insert tables
  await new Promise(r => setTimeout(r, 1500));

  // Get coach ID
  const { data: coaches, error: coachFetchError } = await supabaseCoach
    .from('coaches')
    .select('id')
    .eq('user_id', coachAuth.user.id)
    .limit(1);

  if (coachFetchError || !coaches || coaches.length === 0) {
    console.error('Failed to fetch coach profile:', coachFetchError || 'No coach found');
    return;
  }
  const coachId = coaches[0].id;
  console.log('Coach ID:', coachId);

  // 2. Generate invite code
  console.log('Generating invite code...');
  const { data: inviteCode, error: inviteError } = await supabaseCoach.rpc('generate_invite_code', {
    p_coach_id: coachId,
    p_max_uses: 5
  });

  if (inviteError) {
    console.error('Failed to generate invite code:', inviteError.message);
    return;
  }
  console.log('Generated Invite Code:', inviteCode);

  // 3. Sign up client
  console.log('Signing up client...');
  const supabaseClient = createClient(supabaseUrl, supabaseKey);
  const { data: clientAuth, error: clientAuthError } = await supabaseClient.auth.signUp({
    email: clientEmail,
    password,
    options: {
      data: {
        full_name: 'Auto Test Client',
        role: 'client'
      }
    }
  });

  if (clientAuthError) {
    console.error('Client signup failed:', clientAuthError.message);
    return;
  }
  console.log('Client signed up successfully. User ID:', clientAuth.user.id);

  // Wait 1.5 seconds for triggers
  await new Promise(r => setTimeout(r, 1500));

  // Get client ID
  const { data: clients, error: clientFetchError } = await supabaseClient
    .from('clients')
    .select('id')
    .eq('user_id', clientAuth.user.id)
    .limit(1);

  if (clientFetchError || !clients || clients.length === 0) {
    console.error('Failed to fetch client profile:', clientFetchError || 'No client found');
    return;
  }
  const clientId = clients[0].id;
  console.log('Client ID:', clientId);

  // 4. Use invite code to link client and coach
  console.log('Linking client to coach via invite code...');
  const { data: linkResult, error: linkError } = await supabaseClient.rpc('use_invite_code', {
    p_client_id: clientId,
    p_code: inviteCode
  });

  if (linkError) {
    console.error('Failed to use invite code:', linkError.message);
    return;
  }
  console.log('Link Result:', linkResult);

  // 5. Call create_mother_challenge with low/medium/high
  console.log('\n--- Calling create_mother_challenge with low/medium/high enums ---');
  try {
    const subChallenges1 = [
      {
        name: 'Test Task 1',
        description: 'Description 1',
        assigned_date: new Date().toISOString().split('T')[0],
        focus_type: 'training',
        intensity: 'medium'
      }
    ];

    const { data: data1, error: error1 } = await supabaseCoach.rpc('create_mother_challenge', {
      p_coach_id: coachId,
      p_client_id: clientId,
      p_name: 'Test Plan - medium',
      p_description: 'Test Description',
      p_start_date: new Date().toISOString().split('T')[0],
      p_end_date: new Date().toISOString().split('T')[0],
      p_sub_challenges: subChallenges1,
      p_created_by: 'coach',
      p_mode: 'relative'
    });

    console.log('Result with medium:', { data: data1, error: error1 });
  } catch (e) {
    console.error('Exception with medium:', e);
  }

  // 6. Call create_mother_challenge with light/moderate/intense
  console.log('\n--- Calling create_mother_challenge with light/moderate/intense enums ---');
  try {
    const subChallenges2 = [
      {
        name: 'Test Task 2',
        description: 'Description 2',
        assigned_date: new Date().toISOString().split('T')[0],
        focus_type: 'training',
        intensity: 'moderate'
      }
    ];

    const { data: data2, error: error2 } = await supabaseCoach.rpc('create_mother_challenge', {
      p_coach_id: coachId,
      p_client_id: clientId,
      p_name: 'Test Plan - moderate',
      p_description: 'Test Description',
      p_start_date: new Date().toISOString().split('T')[0],
      p_end_date: new Date().toISOString().split('T')[0],
      p_sub_challenges: subChallenges2,
      p_created_by: 'coach',
      p_mode: 'relative'
    });

    console.log('Result with moderate:', { data: data2, error: error2 });
  } catch (e) {
    console.error('Exception with moderate:', e);
  }
}

run();
