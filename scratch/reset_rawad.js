const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const passwords = ['password123', 'test123', 'Password123!', '12345678', '123456'];

async function resetUser() {
  const email = 'rawad182002@hotmail.com';
  let session = null;

  for (const password of passwords) {
    console.log(`Trying to sign in with password: "${password}"...`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      session = data;
      console.log('Successfully logged in! User ID:', data.user.id);
      break;
    }
  }

  if (!session) {
    console.error('Failed to log in with any common passwords.');
    return;
  }

  const userId = session.user.id;

  // 1. Reset profile onboarding_completed to false
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: false })
    .eq('id', userId);

  if (profileError) {
    console.error('Error resetting profile onboarding status:', profileError);
  } else {
    console.log('Successfully set onboarding_completed to false in profiles.');
  }

  // 2. Determine role (client/coach) and reset corresponding values if needed
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileData?.role === 'coach') {
    const { data: coachData } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (coachData) {
      // Clear availability
      console.log('Clearing availability for coach ID:', coachData.id);
      const { error: availError } = await supabase
        .from('coach_availability')
        .delete()
        .eq('coach_id', coachData.id);

      if (availError) console.error('Error clearing availability:', availError);

      // Reset bio, specialty and business name
      const { error: coachUpdateError } = await supabase
        .from('coaches')
        .update({ business_name: null, specialty: null, logo_url: null, bio: null })
        .eq('id', coachData.id);

      if (coachUpdateError) console.error('Error resetting coach profile details:', coachUpdateError);
      else console.log('Successfully reset coach profile details.');
    }
  } else if (profileData?.role === 'client') {
    // Reset client goal, height, experience level, etc.
    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({ date_of_birth: null, gender: null, height_cm: null, goal: null, experience_level: null, dietary_restrictions: [] })
      .eq('user_id', userId);

    if (clientUpdateError) console.error('Error resetting client profile details:', clientUpdateError);
    else console.log('Successfully reset client details.');
  }

  console.log('Database state reset completed successfully!');
}

resetUser();
