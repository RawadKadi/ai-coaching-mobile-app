import { supabase } from './supabase';
import { textModel } from './google-ai';

export interface SuggestedHabit {
  name: string;
  description: string;
  category: 'training' | 'nutrition' | 'recovery' | 'consistency';
  verification_type: 'none' | 'photo' | 'number';
}

/**
 * Generates a list of suggested daily habits (protocols) for a client
 */
export async function generateDailyProtocol(
  clientId: string,
  clientName: string,
  options: {
    focusType: 'training' | 'nutrition' | 'recovery' | 'consistency';
    intensity: 'low' | 'medium' | 'high';
  }
): Promise<SuggestedHabit[]> {
  try {
    // 1. Fetch client context for better personalization
    const { data: client, error: clientError } = await supabase
      .from('client_profiles')
      .select('goal, experience_level, injuries, fitness_level, focus_areas')
      .eq('id', clientId)
      .single();

    if (clientError) console.warn('Could not fetch client context for AI:', clientError);

    const context = client ? `
      Goal: ${client.goal}
      Level: ${client.experience_level}
      Injuries: ${client.injuries || 'None'}
      Focus: ${client.focus_areas?.join(', ') || 'General fitness'}
    ` : 'General fitness client';

    // 2. Construct the prompt
    const prompt = `
      You are an elite fitness coach strategist. Generate a list of 4-6 high-impact daily habits (protocols) for a client.
      
      Client Name: ${clientName}
      Current Context: ${context}
      Primary Focus: ${options.focusType}
      Intensity Level: ${options.intensity}

      Return exactly this JSON structure:
      [
        {
          "name": "Habit Name",
          "description": "Short description",
          "category": "training",
          "verification_type": "none"
        }
      ]

      Allowed Categories: training, nutrition, recovery, consistency
      Allowed Verification: none, photo, number

      Rules:
      - Use simple, direct language.
      - Make the habits realistic for a ${options.intensity} intensity level.
      - "none" is for a simple checkbox task. "photo" requires a picture. "number" requires a value.
      - IMPORTANT: Return ONLY the JSON array. No markdown code blocks.
    `;

    // 3. Call Gemini
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Robust JSON extraction
    let cleanedText = text.trim();
    
    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Find the first [ and last ] to extract the array
    const firstBracket = cleanedText.indexOf('[');
    const lastBracket = cleanedText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
    }

    try {
      if (!cleanedText || cleanedText === '[]') {
         console.warn('AI returned empty JSON or no brackets. Raw text:', text);
         return [];
      }
      
      const suggestions: SuggestedHabit[] = JSON.parse(cleanedText);
      return suggestions;
    } catch (parseError) {
      console.error('JSON Parse Error. Raw text:', text);
      console.error('Cleaned text attempted to parse:', cleanedText);
      throw new Error('The AI response was not in the expected format. Please try again.');
    }
  } catch (error) {
    console.error('AI Protocol Generation Error:', error);
    throw new Error('Failed to generate daily protocol. Please try again.');
  }
}
