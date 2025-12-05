import { visionModel, fileToGenerativePart } from './google-ai';
import { MealEntry, MealIngredient } from '@/types/database';

/**
 * AI Meal Analysis Service
 * Provides dietitian-level nutritional analysis from food images
 * Specialized for Lebanese and Middle Eastern cuisine
 */

export interface MealAnalysisResult {
    mealName: string;
    description: string;
    confidence: number;

    // Nutrition data
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;

    // Micronutrients
    sodium_mg: number;
    potassium_mg: number;
    calcium_mg: number;
    iron_mg: number;
    vitamin_a_ug: number;
    vitamin_c_mg: number;
    vitamin_d_ug: number;

    // Details
    portionSize: string;
    cookingMethod: string;

    // Ingredients
    ingredients: Array<{
        name: string;
        quantity: number;
        unit: string;
        confidence: number;
    }>;

    // AI notes
    aiNotes: string;
    needsMoreInfo: boolean;
    questions?: string[];  // Follow-up questions if meal is unknown
}

/**
 * Analyze a meal image and return comprehensive nutritional data
 */
export const analyzeMealImage = async (
    imageUri: string,
    cuisinePreference: string = 'lebanese',
    additionalContext?: {
        mealName?: string;
        cookingMethod?: string;
        hasOil?: boolean;
    }
): Promise<MealAnalysisResult> => {
    try {
        // Prepare the image for Gemini
        const imagePart = await fileToGenerativePart(imageUri, 'image/jpeg');

        // Craft dietitian-level prompt
        const prompt = buildDietitianPrompt(cuisinePreference, additionalContext);

        // Generate analysis
        const result = await callWithRetry(() => visionModel.generateContent([prompt, imagePart]));
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const analysisData = parseAIResponse(text);

        return analysisData;
    } catch (error: any) {
        console.error('Error analyzing meal:', error);
        console.error('Error details:', error.message, error.stack);

        // Provide more specific error messages
        if (error.message?.includes('API key')) {
            throw new Error('Invalid API key. Please check your Google AI API key in .env file.');
        }
        if (error.message?.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }

        // Show actual error for debugging
        throw new Error(`Failed to analyze meal: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Build comprehensive dietitian-level prompt
 */
const buildDietitianPrompt = (
    cuisinePreference: string,
    context?: {
        mealName?: string;
        cookingMethod?: string;
        hasOil?: boolean;
    }
): string => {
    const contextInfo = context ? `

ADDITIONAL CONTEXT PROVIDED BY USER:
${context.mealName ? `- Meal name: ${context.mealName}` : ''}
${context.cookingMethod ? `- Cooking method: ${context.cookingMethod}` : ''}
${context.hasOil !== undefined ? `- Oil used: ${context.hasOil ? 'Yes' : 'No'}` : ''}
` : '';

    return `You are a professional dietitian and nutritionist analyzing a meal photo.

PRIMARY CUISINE CONTEXT: ${cuisinePreference.toUpperCase()} cuisine
You should prioritize recognizing ${cuisinePreference} dishes, ingredients, and cooking methods.
${contextInfo}
TASK:
1. Identify the meal/dish name
2. List ALL visible ingredients with estimated quantities
3. Calculate comprehensive nutritional information
4. Provide portion size estimate
5. Identify cooking method

NUTRITIONAL ANALYSIS REQUIREMENTS:
- Estimate MACRONUTRIENTS: calories, protein (g), carbohydrates (g), fats (g), fiber (g), sugar (g)
- Estimate KEY MICRONUTRIENTS: sodium (mg), potassium (mg), calcium (mg), iron (mg), vitamin A (μg), vitamin C (mg), vitamin D (μg)
- Consider cooking method (fried foods have more oil/calories)
- Account for portion size
- Be realistic and conservative with estimates

SPECIAL INSTRUCTIONS FOR LEBANESE/MIDDLE EASTERN CUISINE:
- Recognize traditional dishes: hummus, tabbouleh, shawarma, falafel, kibbeh, fattoush, manakish, etc.
- Account for tahini, olive oil, lemon juice commonly used
- Consider pita bread, rice, bulgur as common bases
- Recognize spices: sumac, za'atar, seven spices

IF MEAL IS UNCLEAR OR UNKNOWN:
- Set "needsMoreInfo" to true
- Provide specific questions in "questions" array
- Still provide best-guess analysis based on visible elements

RESPONSE FORMAT (JSON only, no markdown):
{
  "mealName": "Name of the dish",
  "description": "Brief description of the meal",
  "confidence": 0.85,
  "calories": 450,
  "protein_g": 20,
  "carbs_g": 45,
  "fat_g": 15,
  "fiber_g": 8,
  "sugar_g": 5,
  "sodium_mg": 600,
  "potassium_mg": 400,
  "calcium_mg": 150,
  "iron_mg": 3,
  "vitamin_a_ug": 200,
  "vitamin_c_mg": 15,
  "vitamin_d_ug": 0,
  "portionSize": "1 medium plate (~300g)",
  "cookingMethod": "grilled",
  "ingredients": [
    {"name": "chicken breast", "quantity": 150, "unit": "g", "confidence": 0.9},
    {"name": "rice", "quantity": 100, "unit": "g", "confidence": 0.85}
  ],
  "aiNotes": "This appears to be grilled chicken with rice. Estimated based on visible portion.",
  "needsMoreInfo": false,
  "questions": []
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, just pure JSON.`;
};

/**
 * Parse AI response and validate structure
 */
const parseAIResponse = (text: string): MealAnalysisResult => {
    try {
        // Remove markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanedText);

        // Validate required fields
        if (!parsed.mealName || !parsed.calories) {
            throw new Error('Invalid AI response: missing required fields');
        }

        return parsed as MealAnalysisResult;
    } catch (error) {
        console.error('Error parsing AI response:', error);
        console.error('Raw text:', text);
        throw new Error('Failed to parse meal analysis. Please try again.');
    }
};

/**
 * Re-analyze meal with additional context (for unknown meals)
 */
export const reanalyzeMealWithContext = async (
    imageUri: string,
    mealName: string,
    cookingMethod: string,
    hasOil: boolean,
    cuisinePreference: string = 'lebanese'
): Promise<MealAnalysisResult> => {
    return analyzeMealImage(imageUri, cuisinePreference, {
        mealName,
        cookingMethod,
        hasOil,
    });
};

/**
 * Update meal analysis with modified ingredients
 */
export const recalculateNutrition = async (
    ingredients: MealIngredient[],
    cookingMethod: string
): Promise<Partial<MealAnalysisResult>> => {
    try {
        const ingredientList = ingredients.map(ing =>
            `${ing.ingredient_name}: ${ing.quantity || 'unknown'} ${ing.unit || ''}`
        ).join('\n');

        const prompt = `You are a nutritionist. Calculate total nutrition for these ingredients:

INGREDIENTS:
${ingredientList}

COOKING METHOD: ${cookingMethod}

Provide ONLY macronutrients calculation (calories, protein, carbs, fats, fiber, sugar).
Account for cooking method (fried adds ~20% calories from oil).

RESPONSE FORMAT (JSON only):
{
  "calories": 450,
  "protein_g": 20,
  "carbs_g": 45,
  "fat_g": 15,
  "fiber_g": 8,
  "sugar_g": 5
}`;

        const result = await callWithRetry(() => visionModel.generateContent(prompt));
        const response = await result.response;
        const text = response.text();

        let cleanedText = text.trim();
        if (cleanedText.includes('```')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        return JSON.parse(cleanedText);
    } catch (error) {
        console.error('Error recalculating nutrition:', error);
        throw new Error('Failed to recalculate nutrition.');
    }
};

/**
 * Re-analyze meal with specific user feedback
 */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 2000; // 2 seconds

/**
 * Helper to call AI with retry logic for rate limits
 */
const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    backoff = INITIAL_BACKOFF
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (
            error.message?.includes('429') ||
            error.message?.includes('Resource exhausted') ||
            error.message?.includes('503')
        )) {
            console.warn(`Rate limit hit. Retrying in ${backoff}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return callWithRetry(fn, retries - 1, backoff * 2);
        }
        throw error;
    }
};

/**
 * Re-analyze meal with specific user feedback
 */
export const reanalyzeMealWithFeedback = async (
    imageUri: string,
    previousAnalysis: MealAnalysisResult,
    feedbackType: 'wrong_name' | 'wrong_ingredients' | 'wrong_portion' | 'other',
    feedbackText: string,
    cuisinePreference: string = 'lebanese'
): Promise<MealAnalysisResult> => {
    try {
        const imagePart = await fileToGenerativePart(imageUri, 'image/jpeg');

        const prompt = `You are a professional dietitian. You previously analyzed this meal, but the user has provided feedback that the analysis was incorrect.
        
PREVIOUS ANALYSIS:
${JSON.stringify(previousAnalysis, null, 2)}

USER FEEDBACK (${feedbackType.toUpperCase().replace('_', ' ')}):
"${feedbackText}"

TASK:
Re-analyze the meal image, taking the user's feedback as absolute truth.
- If they say the name is wrong, correct it and update ingredients/nutrition to match the correct dish.
- If they say ingredients are missing/wrong, adjust the list and recalculate nutrition.
- If they say portion size is wrong, scale the nutrition values accordingly.
- Keep correct parts of the previous analysis if they weren't contradicted by feedback.

CUISINE CONTEXT: ${cuisinePreference.toUpperCase()}

RESPONSE FORMAT (JSON only):
Same format as before. Return the complete corrected analysis object.
{
  "mealName": "...",
  "description": "...",
  "confidence": 0.95,
  "calories": ...,
  "protein_g": ...,
  "carbs_g": ...,
  "fat_g": ...,
  "fiber_g": ...,
  "sugar_g": ...,
  "sodium_mg": ...,
  "potassium_mg": ...,
  "calcium_mg": ...,
  "iron_mg": ...,
  "vitamin_a_ug": ...,
  "vitamin_c_mg": ...,
  "vitamin_d_ug": ...,
  "portionSize": "...",
  "cookingMethod": "...",
  "ingredients": [...],
  "aiNotes": "Corrected based on user feedback: ...",
  "needsMoreInfo": false,
  "questions": []
}
`;

        const result = await callWithRetry(() => visionModel.generateContent([prompt, imagePart]));
        const response = await result.response;
        const text = response.text();

        return parseAIResponse(text);
    } catch (error: any) {
        console.error('Error re-analyzing meal with feedback:', error);

        if (error.message?.includes('429') || error.message?.includes('Resource exhausted')) {
            throw new Error('AI is currently busy (rate limit). Please wait a moment and try again.');
        }

        throw new Error(`Failed to update analysis: ${error.message}`);
    }
};
