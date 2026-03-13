import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('Running migration to create chat-media bucket...');

    // Create bucket
    const { data: bucket, error: bucketError } = await supabase
        .storage
        .createBucket('chat-media', {
            public: true,
            fileSizeLimit: 52428800 // 50MB
        });

    if (bucketError) {
        if (bucketError.message.includes('already exists')) {
            console.log('✅ Bucket "chat-media" already exists.');

            // Update it to be public just in case
            await supabase.storage.updateBucket('chat-media', {
                public: true
            });
            console.log('✅ Ensured bucket is public.');
        } else {
            console.error('❌ Error creating bucket:', bucketError.message);
        }
    } else {
        console.log('✅ Bucket created successfully.');
    }

    console.log('\n⚠️ NOTE: Row Level Security (RLS) policies cannot be created effectively through the anon client API.');
    console.log('If you still see upload errors, you MUST run the SQL script in your Supabase Dashboard -> SQL Editor.');
}

runMigration();
