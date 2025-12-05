import { textModel } from './google-ai';
import { Client, Habit } from '@/types/database';

/**
 * AI Challenge Generation Service
 * Creates personalized daily challenges with memory and context awareness
 */

export interface ChallengeGenerationContext {
    clientGoals: string;
    healthConditions: string[];
    experienceLevel: string;
    previousChallenges: Array<{
        name: string;
        description: string;
        completed: boolean;
        date: string;
    }>;
    recentMeals?: Array<{
        name: string;
        calories: number;
        protein_g: number;
    }>;
    challengeDifficulty: 'easy' | 'moderate' | 'hard';
}

export interface GeneratedChallenge {
    name: string;
    description: string;
    target_value?: number;
    unit?: string;
    frequency: string;
    verification_type: 'none' | 'photo' | 'completion';
    category: 'nutrition' | 'fitness' | 'wellness' | 'hydration';
    reasoning: string;  // Why this challenge was chosen
}

/**
 * Generate a personalized daily challenge for a client
 */
export const generateDailyChallenge = async (
    context: ChallengeGenerationContext
): Promise<GeneratedChallenge> => {
    try {
        const prompt = buildChallengePrompt(context);

        const result = await textModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const challenge = parseChallengeResponse(text);

        return challenge;
    } catch (error) {
        console.error('Error generating challenge:', error);
        throw new Error('Failed to generate challenge. Please try again.');
    }
};

/**
 * Build context-aware challenge generation prompt
 */
const buildChallengePrompt = (context: ChallengeGenerationContext): string => {
    const recentChallengesText = context.previousChallenges
        .slice(-7) // Last 7 challenges
        .map(c => `- ${c.name} (${c.completed ? 'Completed' : 'Not completed'}) - ${c.date}`)
        .join('\n');

    const mealsText = context.recentMeals
        ? context.recentMeals
            .slice(-3)
            .map(m => `- ${m.name}: ${m.calories} cal, ${m.protein_g}g protein`)
            .join('\n')
        : 'No recent meal data';

    return `You are an expert fitness coach and dietitian creating a personalized daily challenge.

CLIENT PROFILE:
- Goals: ${context.clientGoals}
- Health Conditions: ${context.healthConditions.join(', ') || 'None'}
- Experience Level: ${context.experienceLevel}
- Challenge Difficulty: ${context.challengeDifficulty}

RECENT CHALLENGES (LAST 7 DAYS):
${recentChallengesText || 'No previous challenges'}

RECENT MEALS (LAST 3):
${mealsText}

YOUR TASK:
Create ONE new daily challenge that:
1. Aligns with the client's goals and fitness level
2. Is DIFFERENT from recent challenges (avoid repetition)
3. Is achievable but slightly challenging
4. Considers their health conditions
5. May relate to their recent nutrition if relevant
6. Matches the difficulty level: ${context.challengeDifficulty}

CHALLENGE CATEGORIES:
- **nutrition**: Diet-related challenges (protein intake, calorie goals, hydration, etc.)
- **fitness**: Exercise challenges (steps, workouts, running, etc.)
- **wellness**: Mental health, sleep, meditation, stress management
- **hydration**: Water intake goals

VERIFICATION TYPES:
- **none**: Simple completion checkbox (e.g., "Meditate for 10 minutes")
- **photo**: Requires photo proof (e.g., "Post-workout selfie", "Healthy meal photo")
- **completion**: Track a numeric value (e.g., "Walk 10,000 steps", "Drink 8 glasses of water")

DIFFICULTY GUIDELINES:
- **easy**: Beginner-friendly, low commitment (e.g., "Walk 5,000 steps", "Drink 6 glasses of water")
- **moderate**: Intermediate effort (e.g., "Walk 10,000 steps", "Complete 30-min workout")
- **hard**: Advanced, high commitment (e.g., "Run 5km", "Complete HIIT workout + 15k steps")

NUTRITION-ALIGNED CHALLENGES:
If recent meals show:
- Low protein → Challenge: "Eat 100g+ protein today"
- High calories → Challenge: "Stay under calorie goal today"
- No vegetables → Challenge: "Eat 5 servings of vegetables"

IMPORTANT RULES:
1. Do NOT repeat challenges from the last 7 days
2. Make challenges specific and measurable
3. Consider health conditions (e.g., no high-impact for joint issues)
4. Match difficulty to experience level
5. Be encouraging and motivational

RESPONSE FORMAT (JSON only, no markdown):
{
  "name": "Walk 10,000 Steps",
  "description": "Take at least 10,000 steps today. Track your progress throughout the day and aim to hit your goal!",
  "target_value": 10000,
  "unit": "steps",
  "frequency": "daily",
  "verification_type": "completion",
  "category": "fitness",
  "reasoning": "Client has been sedentary recently based on meal data. Walking is low-impact and suitable for beginners."
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, just pure JSON.`;
};

/**
 * Parse challenge response from AI
 */
const parseChallengeResponse = (text: string): GeneratedChallenge => {
    try {
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanedText);

        // Validate required fields
        if (!parsed.name || !parsed.description || !parsed.verification_type) {
            throw new Error('Invalid challenge response: missing required fields');
        }

        return parsed as GeneratedChallenge;
    } catch (error) {
        console.error('Error parsing challenge response:', error);
        console.error('Raw text:', text);
        throw new Error('Failed to parse challenge. Please try again.');
    }
};

/**
 * Generate multiple challenge suggestions (for coach to choose from)
 */
export const generateChallengeOptions = async (
    context: ChallengeGenerationContext,
    count: number = 3
): Promise<GeneratedChallenge[]> => {
    const promises = Array.from({ length: count }, () =>
        generateDailyChallenge(context)
    );

    const results = await Promise.all(promises);

    // Deduplicate similar challenges
    const unique = results.filter((challenge, index, self) =>
        index === self.findIndex(c => c.name === challenge.name)
    );

    return unique;
};
