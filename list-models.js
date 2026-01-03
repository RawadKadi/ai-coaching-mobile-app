const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

    if (!apiKey) {
        console.error('❌ No API key');
        return;
    }

    console.log('🔑 Using key:', apiKey.substring(0, 15) + '...');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        console.log('\n📋 Listing available models...\n');

        const models = await genAI.listModels();

        if (models && models.length > 0) {
            models.forEach(model => {
                console.log(`✅ ${model.name}`);
                console.log(`   Display: ${model.displayName}`);
                console.log(`   Methods: ${model.supportedGenerationMethods?.join(', ')}\n`);
            });
        } else {
            console.log('❌ No models available with this API key');
        }
    } catch (error) {
        console.error('❌ Error listing models:', error.message);
        console.log('\n💡 The API key might not have the correct permissions');
        console.log('💡 Go to https://makersuite.google.com/app/apikey and create a new one');
    }
}

listModels();
