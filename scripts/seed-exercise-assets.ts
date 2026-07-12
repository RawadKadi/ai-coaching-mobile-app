import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Load environment variables if running locally via dotenv
import 'dotenv/config';

// 1. Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; // Needs service role key for uploading usually, or anon key if bucket is fully public and allows inserts
const BUCKET_NAME = 'exercise-visuals';

// WGER static images raw Github URL base
const WGER_BASE_URL = 'https://raw.githubusercontent.com/wgerproject/wger/master/wger/exercises/static/exercise-images/';

// A sample list of standard minimalist exercises we want to seed
const EXERCISES_TO_SEED = [
    '1/Bench-press-1.png', '1/Bench-press-2.png',
    '2/Squat-1.png', '2/Squat-2.png',
    '3/Deadlift-1.png', '3/Deadlift-2.png',
    '4/Push-up-1.png', '4/Push-up-2.png',
    '5/Pull-up-1.png', '5/Pull-up-2.png',
    '6/Plank-1.png', '6/Plank-2.png',
    '7/Lunge-1.png', '7/Lunge-2.png',
    '8/Shoulder-press-1.png', '8/Shoulder-press-2.png'
    // Note: To map all images automatically, one would typically use the Github API to list the directory tree
    // For this standalone script, we are demonstrating the pulling and conversion mechanism.
    // If you need all 200+ exercises, use the Github Tree API to get the blob URLs.
];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function processAndUpload() {
    console.log("🚀 Starting Exercise Image Seeding...");
    
    // Create local temp directory
    const tempDir = path.join(__dirname, 'temp-exercise-images');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const imgPath of EXERCISES_TO_SEED) {
        try {
            const url = `${WGER_BASE_URL}${imgPath}`;
            console.log(`⬇️ Downloading: ${url}`);
            
            const imageBuffer = await downloadImage(url);
            
            // Extract a standardized name from the file path
            // e.g. "4/Push-up-1.png" -> "push-up-1"
            const rawName = path.basename(imgPath, path.extname(imgPath));
            const sanitizedName = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const webpFileName = `${sanitizedName}.webp`;
            
            console.log(`⚙️ Converting to WebP: ${webpFileName}`);
            const webpBuffer = await sharp(imageBuffer)
                .webp({ quality: 80, effort: 6 })
                .toBuffer();
                
            console.log(`☁️ Uploading to Supabase: ${BUCKET_NAME}/${webpFileName}`);
            const { data, error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .upload(webpFileName, webpBuffer, {
                    contentType: 'image/webp',
                    upsert: true,
                });
                
            if (error) {
                console.error(`❌ Failed to upload ${webpFileName}:`, error.message);
            } else {
                console.log(`✅ Successfully uploaded: ${webpFileName}`);
            }
            
        } catch (err: any) {
            console.error(`⚠️ Error processing ${imgPath}:`, err.message);
        }
    }
    
    console.log("🎉 Seeding complete!");
}

processAndUpload();
