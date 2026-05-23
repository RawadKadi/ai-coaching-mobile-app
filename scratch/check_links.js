const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's authenticate to bypass RLS or just query it (since we can't query as anon, we can register/login or check if we can fetch)
  // Wait, let's login using a new user
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test_coach_unique_check@example.com',
    password: 'Password123!'
  }).catch(() => ({}));

  if (!authData || !authData.user) {
    // If sign in fails, let's sign up a coach first
    await supabase.auth.signUp({
      email: 'test_coach_unique_check@example.com',
      password: 'Password123!',
      options: { data: { role: 'coach', full_name: 'Check Coach' } }
    });
  }

  // Now select all rows from coach_client_links
  const { data, error } = await supabase.from('coach_client_links').select('*');
  console.log('coach_client_links rows:', data);
  console.log('Error:', error);
}

run();
