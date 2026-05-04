import { supabase } from './supabase';
import { textModel } from './google-ai';

export interface SuggestedHabit {
  name: string;
  description: string;
  category: 'training' | 'nutrition' | 'recovery' | 'consistency';
  verification_type: 'none' | 'camera';
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
      .from('clients')
      .select('goal, experience_level, dietary_restrictions, medical_conditions')
      .eq('id', clientId)
      .single();

    if (clientError) console.warn('Could not fetch client context for AI:', clientError);

    const context = client ? `
      Goal: ${client.goal}
      Level: ${client.experience_level}
      Restrictions: ${client.dietary_restrictions?.join(', ') || 'None'}
      Conditions: ${client.medical_conditions?.join(', ') || 'None'}
    ` : 'General fitness client';

    // 2. Construct the prompt
    const prompt = `
      As an elite fitness coach, generate 3-4 daily habits for:
      Name: ${clientName}
      Context: ${context}
      Focus: ${options.focusType} (${options.intensity} intensity)

      Return ONLY a JSON array:
      [
        {
          "name": "Habit Name",
          "description": "Instructions",
          "category": "training",
          "verification_type": "none"
        }
      ]

      Allowed Categories: training, nutrition, recovery, consistency
      Verification Types: none (checkbox), camera (photo verification)

      IMPORTANT: Return ONLY the JSON array. No text before or after.
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
      
      // Attempt to fix common truncation by adding closing brackets if needed
      if (cleanedText.startsWith('[') && !cleanedText.endsWith(']')) {
        try {
          // Find the last complete object
          const lastComma = cleanedText.lastIndexOf('},');
          if (lastComma !== -1) {
            const fixedText = cleanedText.substring(0, lastComma + 1) + ']';
            return JSON.parse(fixedText);
          }
        } catch (e) {
          // Fallback to error if fix fails
        }
      }
      
      throw new Error('The AI response was not in the expected format. Please try again.');
    }
  } catch (error) {
    console.error('AI Protocol Generation Error:', error);
    throw new Error('Failed to generate daily protocol. Please try again.');
  }
}
