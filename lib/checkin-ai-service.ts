import { generateText } from './google-ai';
import { supabase } from './supabase';

export interface CheckInMetrics {
  weight?: string | number | null;
  sleep?: string | number | null;
  energy?: number | null;
  stress?: number | null;
  hunger?: number | null;
  mood?: string | null;
  notes?: string | null;
}

/**
 * Generate instantaneous rule-based insight when offline or if AI service is busy.
 * Provides clear, everyday coaching feedback adhering to simplicity-first language.
 */
export function generateFallbackCheckInInsight(metrics: CheckInMetrics): string {
  const energy = typeof metrics.energy === 'number' ? metrics.energy : 5;
  const stress = typeof metrics.stress === 'number' ? metrics.stress : 5;
  const sleepHours = metrics.sleep ? parseFloat(metrics.sleep.toString()) : null;
  const mood = (metrics.mood || '').toLowerCase();

  if (sleepHours !== null && sleepHours < 6) {
    if (stress >= 7) {
      return "You had shorter sleep and higher stress today. Focus on good hydration and keep your training session light and controlled.";
    }
    return "Great job checking in after a short night of sleep. Protect your recovery today and get to bed early tonight.";
  }

  if (stress >= 7 && energy <= 4) {
    return "Stress is high and energy is running low today. Listen to your body, take a brisk walk, and make time to unwind.";
  }

  if (energy >= 8) {
    return "Your energy is high and momentum is strong today. Use this drive to crush your workout and stay locked into your nutrition.";
  }

  if (mood.includes('tired') || mood.includes('exhausted')) {
    return "Feeling tired is part of the process. Stay consistent with your meals and aim for deep rest tonight.";
  }

  if (mood.includes('focused') || mood.includes('energized') || mood.includes('great')) {
    return "Your mindset is locked in today. Capitalize on this focus and execute your daily targets with confidence.";
  }

  return "Great work logging your metrics today. Consistent check-ins build long-term results, so keep up the solid momentum.";
}

/**
 * Generate AI-powered check-in coaching insight with fast fallback
 */
export async function generateCheckInAdvice(metrics: CheckInMetrics): Promise<string> {
  const weightStr = metrics.weight ? `${metrics.weight}kg` : 'Not provided';
  const sleepStr = metrics.sleep ? `${metrics.sleep}hrs` : 'Not provided';
  const energyStr = metrics.energy !== undefined && metrics.energy !== null ? `${metrics.energy}/10` : 'Not provided';
  const stressStr = metrics.stress !== undefined && metrics.stress !== null ? `${metrics.stress}/10` : 'Not provided';
  const hungerStr = metrics.hunger !== undefined && metrics.hunger !== null ? `${metrics.hunger}/10` : 'Not provided';
  const moodStr = metrics.mood || 'Not specified';
  const notesStr = metrics.notes ? metrics.notes.trim() : 'None';

  const prompt = `Act as an elite fitness coach. Analyze this client daily check-in:
- Weight: ${weightStr}
- Sleep: ${sleepStr}
- Energy: ${energyStr}
- Stress: ${stressStr}
- Hunger: ${hungerStr}
- Mood: ${moodStr}
- Notes: ${notesStr}

Write exactly 2 short, encouraging coaching sentences.
Use simple, everyday words. No jargon, no fluff, no corporate language.
Speak directly to the client ("You...").`;

  try {
    const rawText = await generateText(prompt);
    let cleaned = rawText.trim();

    // If wrapped in JSON or quotes, extract clean text
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleaned);
        cleaned = parsed.coaching_advice || parsed.advice || parsed.insight || parsed.analysis || cleaned;
      } catch (e) {
        // Keep cleaned as is
      }
    }

    // Strip leading/trailing quotation marks if returned as a quoted string
    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();

    if (cleaned.length >= 10) {
      return cleaned;
    }
  } catch (err) {
    console.warn('[CheckInAI] AI generation failed or timed out, using fallback insight:', err);
  }

  return generateFallbackCheckInInsight(metrics);
}

/**
 * Process check-in AI analysis and save to Supabase
 */
export async function processCheckInAI(checkInId: string, metrics: CheckInMetrics): Promise<string> {
  const advice = await generateCheckInAdvice(metrics);

  if (checkInId && advice) {
    const { error } = await supabase
      .from('check_ins')
      .update({ ai_analysis: advice })
      .eq('id', checkInId);

    if (error) {
      console.error('[CheckInAI] Failed to update check_ins with ai_analysis:', error);
    }
  }

  return advice;
}
