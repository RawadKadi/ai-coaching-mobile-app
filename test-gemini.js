// Test Gemini API Key
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testAPI() {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

    if (!apiKey) {
        console.error('❌ API key not found in .env');
        console.error('Looking for: EXPO_PUBLIC_GOOGLE_AI_API_KEY');
        return;
    }

    console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        console.log('🚀 Testing Gemini Pro...');
        const result = await model.generateContent('Say "API works!" in one word');
        const response = await result.response;
        const text = response.text();

        console.log('✅ Success! Response:', text);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testAPI();
