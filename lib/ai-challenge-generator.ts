import { textModel } from './google-ai';

/**
 * AI Challenge Generator Service
 * Generates personalized challenges respecting coach's AI Brain configuration
 * 
 * CRITICAL PRINCIPLES:
 * 1. AI suggests, NEVER auto-assigns
 * 2. All outputs must respect coach's philosophy and constraints
 * 3. Conservative by default - when in doubt, suggest less
 * 4. Single-output generation (no bulk creation)
 */

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type ChallengeFocusType = 'training' | 'nutrition' | 'recovery' | 'consistency';
export type ChallengeIntensity = 'light' | 'moderate' | 'intense';
export type TriggerType =
    | 'missed_checkins'
    | 'plateau_detected'
    | 'low_energy_trend'
    | 'motivation_drop'
    | 'phase_change'
    | 'manual_request';

export interface AICoachBrain {
    coach_id: string;
    tone: string;
    style: string;
    philosophy?: string;
    rules: string[];
    forbidden_advice: string[];
    training_style?: string;
    forbidden_methods?: string[];
    nutrition_philosophy?: string;
    max_challenge_duration?: number;
    preferred_intensity?: ChallengeIntensity;
    allowed_challenge_types?: ChallengeFocusType[];
    challenge_tone?: string;
}

export interface ClientContext {
    client: {
        id: string;
        goal?: string;
        experience_level?: string;
        health_conditions?: string[];
        dietary_restrictions?: string[];
    };
    recent_checkins?: Array<{
        date: string;
        weight_kg?: number;
        energy_level?: number;
        stress_level?: number;
        mood?: string;
    }>;
    recent_challenges?: Array<{
        name: string;
        focus_type: ChallengeFocusType;
        status: string;
        completed: boolean;
    }>;
    recent_meals?: Array<{
        meal_date: string;
        meal_type: string;
        name: string;
        calories?: number;
        protein_g?: number;
    }>;
    recent_sessions?: Array<{
        scheduled_at: string;
        status: string;
        session_type: string;
        completed: boolean;
    }>;
}

export interface ChallengeGenerationRequest {
    clientContext: ClientContext;
    aiBrain: AICoachBrain;
    triggerType: TriggerType;
    triggerData?: Record<string, any>;
    focusType?: ChallengeFocusType; // Optional: force specific focus
}

export interface GeneratedChallenge {
    name: string;
    description: string;
    focus_type: ChallengeFocusType;
    duration_days: number; // 3-14
    rules: string[];
    reasoning: string; // Why this challenge was chosen
    expected_impact: 'high' | 'medium' | 'low';
    intensity: ChallengeIntensity;
}

// =====================================================
// CORE GENERATION FUNCTION
// =====================================================

/**
 * Generate a challenge from AI Brain configuration
 * This is the PRIMARY function for all AI challenge generation
 */
export const generateChallengeFromBrain = async (
    request: ChallengeGenerationRequest
): Promise<GeneratedChallenge> => {
    try {
        // Validate AI Brain exists
        if (!request.aiBrain) {
            throw new Error('AI Brain configuration is required for AI challenge generation');
        }

        // Build context-aware prompt
        const prompt = buildChallengePrompt(request);

        // Call Google AI
        const result = await textModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse and validate response
        const challenge = parseChallengeResponse(text);

        // Validate against AI Brain constraints
        validateChallengeAgainstBrain(challenge, request.aiBrain);

        return challenge;
    } catch (error) {
        console.error('[AI Challenge Generator] Error:', error);

        // Fallback to safe default challenge
        return generateFallbackChallenge(request);
    }
};

/**
 * Generate multiple challenge options for coach to choose from
 * Used for on-demand generation with choice
 */
export const generateChallengeOptions = async (
    request: ChallengeGenerationRequest,
    count: number = 3
): Promise<GeneratedChallenge[]> => {
    try {
        const prompt = buildMultipleOptionsPrompt(request, count);

        const result = await textModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const options = parseMultipleChallengesResponse(text);

        // Validate each option
        options.forEach(challenge => {
            validateChallengeAgainstBrain(challenge, request.aiBrain);
        });

        return options.slice(0, count); // Ensure max count
    } catch (error) {
        console.error('[AI Challenge Generator] Error generating options:', error);
        // Return single fallback
        return [generateFallbackChallenge(request)];
    }
};

// =====================================================
// PROMPT BUILDERS
// =====================================================

const buildChallengePrompt = (request: ChallengeGenerationRequest): string => {
    const { clientContext, aiBrain, triggerType, triggerData, focusType } = request;

    const recentChallengesText = clientContext.recent_challenges
        ?.slice(-5)
        ?.map(c => `- ${c.name} (${c.focus_type}) - ${c.completed ? 'COMPLETED' : 'NOT COMPLETED'}`)
        .join('\n') || 'No recent challenges';

    const checkinTrendText = clientContext.recent_checkins
        ?.slice(-7)
        ?.map(c => `- ${c.date}: Energy ${c.energy_level}/5, Stress ${c.stress_level}/5, Mood: ${c.mood}`)
        .join('\n') || 'No recent check-ins';

    const mealTrendText = clientContext.recent_meals
        ?.slice(-5)
        ?.map(m => `- ${m.meal_date}: ${m.name} (${m.calories || '?'} cal, ${m.protein_g || '?'}g protein)`)
        .join('\n') || 'No recent meal data';

    const sessionTrendText = clientContext.recent_sessions
        ?.slice(-5)
        ?.map(s => `- ${s.scheduled_at}: ${s.session_type} - ${s.completed ? 'COMPLETED' : 'MISSED'}`)
        .join('\n') || 'No recent sessions';

    // Build allowedTypesText
    const allowedTypes = aiBrain.allowed_challenge_types || ['training', 'nutrition', 'recovery', 'consistency'];
    const allowedTypesText = allowedTypes.join(', ');

    // Build forbiddenText
    const forbiddenMethods = [
        ...(aiBrain.forbidden_methods || []),
        ...(aiBrain.forbidden_advice || [])
    ];
    const forbiddenText = forbiddenMethods.length > 0
        ? forbiddenMethods.map(f => `- ${f}`).join('\n')
        : 'None specified';

    return `You are an AI assistant helping a certified fitness coach design a personalized challenge for their client.

=== CRITICAL: COACH AUTHORITY FIRST ===
- You are SUGGESTING a challenge, NOT assigning it
- The coach MUST approve before the client sees it
- Be conservative and respectful of the coach's philosophy
- When in doubt, suggest LESS, not more

=== COACH'S AI BRAIN CONFIGURATION ===
Training Style: ${aiBrain.training_style || 'balanced'}
Nutrition Philosophy: ${aiBrain.nutrition_philosophy || 'flexible'}
Preferred Intensity: ${aiBrain.preferred_intensity || 'moderate'}
Tone/Language: ${aiBrain.challenge_tone || aiBrain.tone || 'encouraging'}
Max Challenge Duration: ${aiBrain.max_challenge_duration || 14} days
Allowed Challenge Types: ${allowedTypesText}

=== FORBIDDEN METHODS (NEVER SUGGEST THESE) ===
${forbiddenText}

=== CLIENT PROFILE ===
Goal: ${clientContext.client.goal || 'Not specified'}
Experience Level: ${clientContext.client.experience_level || 'beginner'}
Health Conditions: ${clientContext.client.health_conditions?.join(', ') || 'None'}
Dietary Restrictions: ${clientContext.client.dietary_restrictions?.join(', ') || 'None'}

=== TRIGGER REASON ===
Why this challenge is being suggested: ${triggerType}
${triggerData ? `Additional context: ${JSON.stringify(triggerData)}` : ''}

=== RECENT CLIENT BEHAVIOR ===

Check-in Trend (Last 7 days):
${checkinTrendText}

Recent Challenges:
${recentChallengesText}

Recent Meals:
${mealTrendText}

Recent Sessions:
${sessionTrendText}

=== YOUR TASK ===
Create ONE challenge that:
1. Aligns with the coach's training style and philosophy
2. Respects all forbidden methods (DO NOT suggest anything on the forbidden list)
3. Is appropriate for the client's experience level
4. Addresses the trigger reason (${triggerType})
5. Is DIFFERENT from recent challenges (avoid repetition)
6. Has a duration between 3 and ${aiBrain.max_challenge_duration || 14} days
7. Uses the coach's preferred tone: ${aiBrain.challenge_tone || 'encouraging'}
8. Matches intensity level: ${aiBrain.preferred_intensity || 'moderate'}
${focusType ? `9. MUST be focus_type: ${focusType}` : ''}

=== CHALLENGE FOCUS TYPES ===
- **training**: Exercise, strength, cardio, mobility, consistency
- **nutrition**: Protein intake, hydration, calorie goals, meal prep, vegetables
- **recovery**: Sleep, rest days, stretching, stress management
- **consistency**: Daily check-ins, habit stacking, accountability

=== INTENSITY LEVELS ===
- **light**: Easy, accessible, low commitment (e.g., "Walk 5k steps daily", "Drink 6 glasses of water")
- **moderate**: Intermediate effort (e.g., "Walk 10k steps daily", "Complete 3 workouts this week")
- **intense**: Advanced, high commitment (e.g., "Run 5k 3x this week", "Complete HIIT + 15k steps daily")

=== DURATION GUIDELINES ===
- 3-5 days: Quick wins, habit testing, recovery challenges
- 6-10 days: Moderate commitment, skill building
- 11-14 days: Long-term habit formation, significant behavior change

=== RULES FORMAT ===
Rules should be:
- Specific and measurable
- Actionable (client knows exactly what to do)
- Time-bound (daily, 3x per week, etc.)
- 3-5 rules maximum

Example Rules:
- "Walk at least 10,000 steps every day"
- "Log all meals with photos in the app"
- "Complete 3 strength training sessions this week"
- "Sleep at least 7 hours per night"
- "Drink 2L of water daily"

=== RESPONSE FORMAT (JSON ONLY) ===
{
  "name": "Challenge Name (concise, motivational)",
  "description": "Full description explaining what, why, and how (2-3 sentences)",
  "focus_type": "training | nutrition | recovery | consistency",
  "duration_days": 3-14,
  "rules": [
    "Rule 1 (specific, measurable)",
    "Rule 2",
    "Rule 3"
  ],
  "reasoning": "Why this challenge addresses the trigger and fits the client (1-2 sentences)",
  "expected_impact": "high | medium | low",
  "intensity": "light | moderate | intense"
}

=== IMPORTANT ===
- Return ONLY valid JSON (no markdown, no code blocks, no extra text)
- DO NOT suggest anything from the forbidden list
- Respect the coach's philosophy and constraints
- Be conservative: if unsure, suggest an easier challenge
- Make it achievable but challenging

Generate the challenge now:`;
};

const buildMultipleOptionsPrompt = (request: ChallengeGenerationRequest, count: number): string => {
    const basePrompt = buildChallengePrompt(request);

    return `${basePrompt}

=== ADDITIONAL INSTRUCTION ===
Generate ${count} DIFFERENT challenge options (varying in focus_type, intensity, or duration).
Return as a JSON array of ${count} challenges:

[
  { "name": "...", "description": "...", ... },
  { "name": "...", "description": "...", ... },
  { "name": "...", "description": "...", ... }
]

Each challenge should be distinct and offer different approaches to addressing the trigger.`;
};

// =====================================================
// RESPONSE PARSERS
// =====================================================

const parseChallengeResponse = (text: string): GeneratedChallenge => {
    try {
        let cleanedText = text.trim();

        // Remove markdown code blocks if present
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanedText);

        // Validate required fields
        if (!parsed.name || !parsed.focus_type || !parsed.duration_days) {
            throw new Error('Missing required fields in AI response');
        }

        // Ensure duration is within bounds
        if (parsed.duration_days < 3 || parsed.duration_days > 14) {
            parsed.duration_days = Math.max(3, Math.min(14, parsed.duration_days));
        }

        // Ensure rules is an array
        if (!Array.isArray(parsed.rules)) {
            parsed.rules = [];
        }

        return parsed as GeneratedChallenge;
    } catch (error) {
        console.error('[AI Challenge Generator] Parse error:', error);
        console.error('Raw text:', text);
        throw new Error('Failed to parse AI challenge response');
    }
};

const parseMultipleChallengesResponse = (text: string): GeneratedChallenge[] => {
    try {
        let cleanedText = text.trim();

        // Remove markdown
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanedText);

        if (!Array.isArray(parsed)) {
            throw new Error('Expected array of challenges');
        }

        return parsed.map((item, index) => {
            if (!item.name || !item.focus_type || !item.duration_days) {
                throw new Error(`Challenge at index ${index} missing required fields`);
            }

            // Ensure duration bounds
            if (item.duration_days < 3 || item.duration_days > 14) {
                item.duration_days = Math.max(3, Math.min(14, item.duration_days));
            }

            // Ensure rules array
            if (!Array.isArray(item.rules)) {
                item.rules = [];
            }

            return item as GeneratedChallenge;
        });
    } catch (error) {
        console.error('[AI Challenge Generator] Parse multiple error:', error);
        throw error;
    }
};

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validate challenge against AI Brain constraints
 * Throws error if challenge violates any constraints
 */
const validateChallengeAgainstBrain = (
    challenge: GeneratedChallenge,
    aiBrain: AICoachBrain
): void => {
    // Check allowed challenge types
    const allowedTypes = aiBrain.allowed_challenge_types || ['training', 'nutrition', 'recovery', 'consistency'];
    if (!allowedTypes.includes(challenge.focus_type)) {
        throw new Error(`Challenge focus_type '${challenge.focus_type}' not allowed by coach configuration`);
    }

    // Check duration limit
    const maxDuration = aiBrain.max_challenge_duration || 14;
    if (challenge.duration_days > maxDuration) {
        throw new Error(`Challenge duration ${challenge.duration_days} exceeds coach's max of ${maxDuration} days`);
    }

    // Check forbidden methods
    const forbiddenMethods = [
        ...(aiBrain.forbidden_methods || []),
        ...(aiBrain.forbidden_advice || [])
    ].map(f => f.toLowerCase());

    const challengeText = `${challenge.name} ${challenge.description} ${challenge.rules.join(' ')}`.toLowerCase();

    for (const forbidden of forbiddenMethods) {
        if (challengeText.includes(forbidden.toLowerCase())) {
            throw new Error(`Challenge contains forbidden method/advice: '${forbidden}'`);
        }
    }
};

// =====================================================
// FALLBACK CHALLENGE
// =====================================================

/**
 * Generate a safe, conservative fallback challenge
 * Used when AI generation fails or violates constraints
 */
const generateFallbackChallenge = (request: ChallengeGenerationRequest): GeneratedChallenge => {
    const { clientContext, triggerType } = request;

    // Conservative defaults based on trigger type
    const fallbacks: Record<TriggerType, GeneratedChallenge> = {
        missed_checkins: {
            name: 'Daily Check-In Challenge',
            description: 'Build consistency by checking in every day. Track your weight, energy, and mood to help your coach better support you.',
            focus_type: 'consistency',
            duration_days: 7,
            rules: [
                'Complete your daily check-in every morning',
                'Track your weight, energy level, and mood',
                'Add a brief note about how you\'re feeling'
            ],
            reasoning: 'Client has missed recent check-ins. This challenge rebuilds the check-in habit.',
            expected_impact: 'high',
            intensity: 'light'
        },
        plateau_detected: {
            name: 'Nutrition Awareness Challenge',
            description: 'Break through your plateau by focusing on consistent nutrition tracking and protein intake.',
            focus_type: 'nutrition',
            duration_days: 7,
            rules: [
                'Log every meal with a photo',
                'Aim for your protein target daily',
                'Drink at least 2L of water per day'
            ],
            reasoning: 'Client progress has plateaued. Focusing on nutrition tracking to identify opportunities.',
            expected_impact: 'medium',
            intensity: 'moderate'
        },
        low_energy_trend: {
            name: 'Recovery & Energy Challenge',
            description: 'Boost your energy by prioritizing recovery, sleep, and stress management.',
            focus_type: 'recovery',
            duration_days: 7,
            rules: [
                'Get at least 7 hours of sleep each night',
                'Take at least one 10-minute walk outside daily',
                'Practice 5 minutes of deep breathing or meditation'
            ],
            reasoning: 'Client has shown low energy levels. This challenge focuses on recovery and stress reduction.',
            expected_impact: 'high',
            intensity: 'light'
        },
        motivation_drop: {
            name: 'Small Wins Challenge',
            description: 'Build momentum with achievable daily wins. Focus on consistency over perfection.',
            focus_type: 'consistency',
            duration_days: 5,
            rules: [
                'Move your body for at least 15 minutes daily',
                'Complete your daily check-in',
                'Choose one healthy meal each day'
            ],
            reasoning: 'Client motivation has dropped. This challenge provides quick wins to rebuild confidence.',
            expected_impact: 'medium',
            intensity: 'light'
        },
        phase_change: {
            name: 'New Phase Kickstart',
            description: 'Start your new training phase strong with focused effort and consistency.',
            focus_type: 'training',
            duration_days: 7,
            rules: [
                'Complete all scheduled workouts this week',
                'Log your workout details for each session',
                'Focus on proper form and technique'
            ],
            reasoning: 'Client is beginning a new training phase. This challenge sets the tone for success.',
            expected_impact: 'high',
            intensity: 'moderate'
        },
        manual_request: {
            name: 'Weekly Wellness Challenge',
            description: 'A balanced approach to improving overall wellness through movement, nutrition, and recovery.',
            focus_type: 'consistency',
            duration_days: 7,
            rules: [
                'Move your body for at least 30 minutes daily',
                'Eat at least 3 servings of vegetables per day',
                'Get 7+ hours of sleep each night'
            ],
            reasoning: 'A well-rounded challenge to support overall health and wellness.',
            expected_impact: 'medium',
            intensity: 'moderate'
        }
    };

    return fallbacks[triggerType] || fallbacks.manual_request;
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format challenge for client display
 * Converts technical challenge data to user-friendly format
 */
export const formatChallengeForClient = (challenge: GeneratedChallenge): string => {
    const emoji = {
        training: '💪',
        nutrition: '🥗',
        recovery: '😴',
        consistency: '🎯'
    };

    return `${emoji[challenge.focus_type]} **${challenge.name}**

${challenge.description}

**Your Mission:**
${challenge.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

**Duration:** ${challenge.duration_days} days
**Intensity:** ${challenge.intensity}

Let's do this! 🚀`;
};

/**
 * Suggest challenge for a detected trigger
 * This is called by background jobs for passive suggestions
 */
export const suggestChallengeForTrigger = async (
    trigger: {
        client_id: string;
        coach_id: string;
        trigger_type: TriggerType;
        trigger_data: Record<string, any>;
        priority: number;
    },
    clientContext: ClientContext,
    aiBrain: AICoachBrain
): Promise<GeneratedChallenge> => {
    const request: ChallengeGenerationRequest = {
        clientContext,
        aiBrain,
        triggerType: trigger.trigger_type,
        triggerData: trigger.trigger_data
    };

    return await generateChallengeFromBrain(request);
};
