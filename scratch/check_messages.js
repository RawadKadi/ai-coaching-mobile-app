const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching messages:', error.message);
    return;
  }

  console.log('Last 10 messages:');
  data.forEach((msg, idx) => {
    console.log(`\n--- Message ${idx + 1} ---`);
    console.log(`ID: ${msg.id}`);
    console.log(`Sender ID: ${msg.sender_id}`);
    console.log(`Recipient ID: ${msg.recipient_id}`);
    console.log(`Reply To ID: ${msg.reply_to_id}`);
    console.log(`Content type: ${typeof msg.content}`);
    console.log(`Content: ${JSON.stringify(msg.content)}`);
  });
}

check();
