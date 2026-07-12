/**
 * Seed script: Reads local exercises-dataset folder and uploads to Supabase.
 * Uses exercises.json to map exercise names → kebab-case filenames.
 *
 * Run: npx tsx scripts/seed-everkinetic-assets.ts
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'exercise-visuals';

const DATASET_ROOT = path.join(__dirname, 'exercises-dataset', 'exercises-dataset-main');
const EXERCISES_JSON = path.join(DATASET_ROOT, 'data', 'exercises.json');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials. Check your .env file.');
    process.exit(1);
}

if (!fs.existsSync(EXERCISES_JSON)) {
    console.error(`❌ exercises.json not found at: ${EXERCISES_JSON}`);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sanitizeName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

async function processAndUpload() {
    console.log('🚀 Starting GymVisual exercise asset seeding...');

    // 1. Read and parse exercises.json
    const rawJson = fs.readFileSync(EXERCISES_JSON, 'utf-8');
    const exercises: any[] = JSON.parse(rawJson);
    console.log(`📋 Found ${exercises.length} exercises in dataset.`);

    // Prioritize testing exercises
    const priorityKeywords = ['push-up', 'potty squat', 'biceps curl', 'plank', 'lunge'];
    exercises.sort((a, b) => {
        const nameA = (a.name?.en || a.name || '').toLowerCase();
        const nameB = (b.name?.en || b.name || '').toLowerCase();
        const aPriority = priorityKeywords.some(kw => nameA.includes(kw)) ? 1 : 0;
        const bPriority = priorityKeywords.some(kw => nameB.includes(kw)) ? 1 : 0;
        return bPriority - aPriority;
    });

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const ex of exercises) {
        const name: string = ex.name?.en || ex.name || '';
        const gifPath: string = ex.gif_url || '';

        if (!name || !gifPath) {
            skipCount++;
            continue;
        }

        const sanitized = sanitizeName(name);
        if (!sanitized || sanitized.length < 2) {
            skipCount++;
            continue;
        }

        const webpFileName = `${sanitized}.webp`;
        const localImagePath = path.join(DATASET_ROOT, gifPath);

        if (!fs.existsSync(localImagePath)) {
            console.warn(`  ⚠️  Image not found on disk: ${localImagePath} (skipping)`);
            skipCount++;
            continue;
        }

        try {
            console.log(`⚙️  Processing (Upscaling & Sharpening): "${name}" -> ${webpFileName}`);

            const webpBuffer = await sharp(localImagePath, { animated: true })
                .resize(540, 540, {
                    kernel: sharp.kernel.lanczos3,
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .sharpen({
                    sigma: 1.0,
                    m1: 1.0,
                    m2: 2.0
                })
                .webp({ quality: 90, effort: 5 })
                .toBuffer();

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(webpFileName, webpBuffer, {
                    contentType: 'image/webp',
                    upsert: true,
                });

            if (error) {
                console.error(`  ❌ Upload failed: ${webpFileName} — ${error.message}`);
                failCount++;
            } else {
                console.log(`  ✅ Uploaded: ${webpFileName}`);
                successCount++;
            }
        } catch (err: any) {
            console.error(`  ⚠️  Error on "${name}": ${err.message}`);
            failCount++;
        }
    }

    console.log(`\n🎉 Done! ✅ Uploaded: ${successCount} | ⏭️ Skipped: ${skipCount} | ❌ Failed: ${failCount}`);
    console.log(`\n📌 Files uploaded to: Supabase storage → ${BUCKET_NAME}/`);
}

processAndUpload();
