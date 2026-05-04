const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ieqccstmunvlmxsohhsa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcWNjc3RtdW52bG14c29oaHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNjQ4NTUsImV4cCI6MjA3OTY0MDg1NX0.-EoFZubBB_5iy6zcMhHg9_P3_WzBizN8XLc5FAp_boY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
  console.log('Fetching all profiles to find the active user...');
  
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(10);

  if (pError) {
    console.error('Error fetching profiles:', pError);
    process.exit(1);
  }

  console.log('--- Top 10 Recently Seen Profiles ---');
  profiles.forEach(p => {
    console.log(`ID: ${p.id} | Name: ${p.full_name} | Last Seen: ${p.last_seen_at}`);
  });
}

checkStatus();
