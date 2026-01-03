import { supabase } from './supabase';

export interface SubChallengeTemplate {
    name: string;
    description: string;
    assigned_date: string;
    focus_type: 'training' | 'nutrition' | 'recovery' | 'consistency';
    intensity: 'low' | 'medium' | 'high';
}

export interface ClientChallengeHistory {
    task_name: string;
    task_description: string;
    focus_type: string;
    intensity: string;
    assigned_date: string;
    completed: boolean;
    completed_at: string | null;
}

const CHALLENGE_TEMPLATES = {
    training: [
        { name: 'Upper body strength workout', desc: 'Push-ups 3x12, Pull-ups 3x8, Shoulder press 3x10, Dips 3x10', intensity: 'medium' },
        { name: 'Lower body power session', desc: 'Squats 4x10, Lunges 3x12 each leg, Calf raises 3x15, Glute bridges 3x15', intensity: 'high' },
        { name: 'Core strength training', desc: 'Planks 3x60s, Russian twists 3x20, Leg raises 3x12, Bicycle crunches 3x20', intensity: 'medium' },
        { name: 'Cardio endurance run', desc: '30 min moderate pace running or cycling, track distance and average heart rate', intensity: 'medium' },
        { name: 'HIIT training session', desc: '20 min: 30s max effort sprint, 30s rest - repeat 20 cycles', intensity: 'high' },
        { name: 'Full body mobility flow', desc: '20 minutes dynamic stretching and mobility work - hips, shoulders, spine', intensity: 'low' },
        { name: 'Leg day workout', desc: 'Deadlifts 4x8, Bulgarian split squats 3x10 each, Leg press 3x12', intensity: 'high' },
        { name: 'Active recovery walk', desc: '45 min brisk walk outdoors, focus on posture and breathing', intensity: 'low' },
        { name: 'Swimming session', desc: '30 min continuous swim - freestyle or mixed strokes', intensity: 'medium' },
        { name: 'Bodyweight circuit', desc: '4 rounds: 15 burpees, 20 squats, 15 push-ups, 30s plank', intensity: 'high' },
    ],
    nutrition: [
        { name: 'High protein breakfast', desc: '35g protein minimum - eggs, Greek yogurt, protein shake, or lean meat', intensity: 'low' },
        { name: 'Daily hydration goal', desc: 'Drink 3 liters of water throughout the day, track intake', intensity: 'low' },
        { name: 'Vegetable servings target', desc: '5 servings of colorful vegetables spread across all meals', intensity: 'medium' },
        { name: 'Meal prep session', desc: 'Prepare 3 balanced meals for tomorrow - protein, carbs, veggies', intensity: 'medium' },
        { name: 'Lean protein dinner', desc: 'Grilled chicken, fish, or tofu with steamed vegetables - 40g protein', intensity: 'low' },
        { name: 'Healthy snack prep', desc: 'Prepare 3 healthy snacks: nuts, fruits, protein bars, or veggie sticks', intensity: 'low' },
        { name: 'Post-workout nutrition', desc: 'Within 30 min after training: 25g protein + 40g carbs', intensity: 'medium' },
        { name: 'Reduce processed foods', desc: 'No processed or packaged foods today - whole foods only', intensity: 'medium' },
        { name: 'Fiber intake goal', desc: '30g fiber from vegetables, fruits, whole grains, and legumes', intensity: 'low' },
        { name: 'Balanced dinner plate', desc: '50% vegetables, 25% lean protein, 25% complex carbs', intensity: 'low' },
    ],
    recovery: [
        { name: 'Full body stretching', desc: '15 minutes static stretching - hold each stretch for 30 seconds', intensity: 'low' },
        { name: 'Sleep optimization', desc: '7-8 hours quality sleep, no screens 1 hour before bed', intensity: 'low' },
        { name: 'Foam rolling session', desc: '10-15 minutes foam rolling major muscle groups - legs, back, shoulders', intensity: 'low' },
        { name: 'Active rest day', desc: 'Light yoga, walking, or swimming - 20-30 minutes gentle movement', intensity: 'low' },
        { name: 'Morning meditation', desc: '10 minutes mindfulness meditation or breathing exercises', intensity: 'low' },
        { name: 'Ice bath or cold shower', desc: '3-5 minutes cold exposure for recovery and inflammation reduction', intensity: 'medium' },
        { name: 'Massage or self-massage', desc: '20 minutes self-massage with massage ball or hands', intensity: 'low' },
        { name: 'Gentle yoga flow', desc: '25 minutes restorative yoga focusing on flexibility and relaxation', intensity: 'low' },
    ],
    consistency: [
        { name: 'Track all meals', desc: 'Log every meal and snack in your tracking app today', intensity: 'low' },
        { name: 'Morning routine', desc: 'Complete your morning routine: wake, water, stretch, plan day', intensity: 'low' },
        { name: 'Step count goal', desc: '10,000 steps minimum - track with fitness app', intensity: 'medium' },
        { name: 'Check-in with coach', desc: 'Send progress update message to your coach', intensity: 'low' },
    ]
};

/**
 * Generate a week of contextual challenges using templates
 * Avoids repetition by checking client history
 */
export async function generateWeeklyChallenges(
    clientId: string,
    clientName: string,
    startDate: Date
): Promise<SubChallengeTemplate[]> {
    try {
        // 1. Fetch client's challenge history to avoid repetition
        const { data: history, error } = await supabase.rpc('get_client_challenge_history', {
            p_client_id: clientId
        });

        if (error) {
            console.error('Error fetching history:', error);
        }

        const challengeHistory = (history || []) as ClientChallengeHistory[];
        const usedNames = new Set(challengeHistory.map(h => h.task_name));

        console.log(`[AI] Generating for ${clientName}, avoiding ${usedNames.size} previous challenges`);

        const challenges: SubChallengeTemplate[] = [];

        // 2. Generate 3 challenges per day for 7 days (21 total)
        for (let day = 0; day < 7; day++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + day);
            const dateStr = date.toISOString().split('T')[0];

            // Pick 1 from each category, avoiding previous challenges
            const training = pickUnused(CHALLENGE_TEMPLATES.training, usedNames);
            const nutrition = pickUnused(CHALLENGE_TEMPLATES.nutrition, usedNames);
            const recovery = pickUnused(CHALLENGE_TEMPLATES.recovery, usedNames);

            challenges.push(
                {
                    name: training.name,
                    description: training.desc,
                    assigned_date: dateStr,
                    focus_type: 'training',
                    intensity: training.intensity as any
                },
                {
                    name: nutrition.name,
                    description: nutrition.desc,
                    assigned_date: dateStr,
                    focus_type: 'nutrition',
                    intensity: nutrition.intensity as any
                },
                {
                    name: recovery.name,
                    description: recovery.desc,
                    assigned_date: dateStr,
                    focus_type: 'recovery',
                    intensity: recovery.intensity as any
                }
            );

            // Mark as used
            usedNames.add(training.name);
            usedNames.add(nutrition.name);
            usedNames.add(recovery.name);
        }

        console.log(`[AI] Generated ${challenges.length} unique challenges`);
        return challenges;

    } catch (error) {
        console.error('Challenge generation error:', error);
        throw error;
    }
}

/**
 * Pick a random template that hasn't been used recently
 */
function pickUnused(templates: any[], usedNames: Set<string>) {
    const available = templates.filter(t => !usedNames.has(t.name));

    // If all have been used, pick any (client has done many challenges)
    if (available.length === 0) {
        return templates[Math.floor(Math.random() * templates.length)];
    }

    // Pick random from available
    return available[Math.floor(Math.random() * available.length)];
}
