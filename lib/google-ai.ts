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

export const visionModel = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
        temperature: 0.4,  // Lower for more consistent nutritional data
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
    }
});

// Gemini model for structured/JSON tasks (challenge generation, protocol suggestions)
export const textModel = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
        temperature: 0.7,  // Higher for creative challenge generation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
    }
});

// Gemini model for natural text generation (insights, advice, explanations)
export const plainTextModel = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
    }
});

/**
 * Helper to check if AI is available
 */
export const isAIAvailable = (): boolean => {
    return !!API_KEY;
};

import { Platform } from 'react-native';

/**
 * Format file data for Gemini Vision API (React Native compatible)
 */
export const fileToGenerativePart = async (uri: string, mimeType: string) => {
    try {
        let base64;
        
        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        // reader.result is "data:image/jpeg;base64,..."
                        const base64String = reader.result.split(',')[1];
                        resolve(base64String);
                    } else {
                        reject(new Error('Failed to read file as base64'));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } else {
            // Use Expo FileSystem to read the image as base64 natively
            base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
        }

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
 * Helper to wrap a promise with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
};

/**
 * Generate text from a prompt using Gemini.
 * Uses fast plain text generation with timeout and automatic model fallback.
 */
export const generateText = async (prompt: string): Promise<string> => {
    if (!API_KEY) {
        throw new Error('Google AI API key is not configured');
    }

    const candidateModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            });

            const result = await withTimeout(
                model.generateContent(prompt),
                7000,
                `Timeout generating content with ${modelName}`
            );

            const response = await result.response;
            const text = response.text();
            if (text && text.trim().length > 0) {
                return text.trim();
            }
        } catch (error: any) {
            console.warn(`[Google AI] Model ${modelName} failed or timed out:`, error?.message || error);
            // Continue to next candidate model
        }
    }

    throw new Error('All AI models failed to generate text');
};
