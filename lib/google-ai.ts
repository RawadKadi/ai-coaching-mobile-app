import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Google Gemini AI Configuration
 * Using Gemini 1.5 Flash for cost-effective vision and text generation
 */

// Initialize the Gemini API client
const API_KEY = Constants.expoConfig?.extra?.GOOGLE_AI_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY;

if (!API_KEY) {
    console.warn('⚠️ Google AI API key not found. AI features will not work.');
}

export const genAI = new GoogleGenerativeAI(API_KEY || '');

// Gemini 1.5 Flash model for vision tasks (meal analysis)
export const visionModel = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: {
        temperature: 0.4,  // Lower for more consistent nutritional data
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
    }
});

// Gemini 1.5 Flash model for text tasks (challenge generation)
export const textModel = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: {
        temperature: 0.7,  // Higher for creative challenge generation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
    }
});

/**
 * Helper to check if AI is available
 */
export const isAIAvailable = (): boolean => {
    return !!API_KEY;
};

/**
 * Format file data for Gemini Vision API (React Native compatible)
 */
export const fileToGenerativePart = async (uri: string, mimeType: string) => {
    try {
        // Use Expo FileSystem to read the image as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
        });

        return {
            inlineData: {
                data: base64,
                mimeType,
            },
        };
    } catch (error) {
        console.error('Error reading image file:', error);
        throw new Error('Failed to read image file');
    }
};
/**
 * Generate text from a prompt using Gemini
 */
export const generateText = async (prompt: string): Promise<string> => {
    try {
        const result = await textModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating text:', error);
        throw new Error('Failed to generate text');
    }
};
