import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MealPlanRequest {
  clientId: string;
  dailyCalories: number;
  restrictions: string[];
  preferences: string[];
  cookingTime?: string;
  durationDays: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: MealPlanRequest = await req.json();

    const { data: client } = await supabaseClient
      .from('clients')
      .select('*, profiles(*)')
      .eq('id', requestData.clientId)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    const prompt = `You are a professional nutritionist. Create a ${requestData.durationDays}-day meal plan.

Client Details:
- Daily Calories: ${requestData.dailyCalories}
- Dietary Restrictions: ${requestData.restrictions.join(', ') || 'None'}
- Preferences: ${requestData.preferences.join(', ') || 'None'}
- Cooking Time: ${requestData.cookingTime || 'Any'}

Provide a structured meal plan with:
1. Daily meals (breakfast, lunch, dinner, snacks)
2. Calorie breakdown for each meal
3. Macro breakdown (protein, carbs, fats)
4. Simple recipes
5. Weekly shopping list

Format as JSON with this structure:
{
  "days": [
    {
      "day": 1,
      "meals": [
        {
          "type": "breakfast",
          "name": "Meal name",
          "calories": 400,
          "protein_g": 25,
          "carbs_g": 45,
          "fat_g": 12,
          "recipe": "Simple instructions"
        }
      ]
    }
  ],
  "shopping_list": ["item1", "item2"]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const mealPlanData = JSON.parse(responseText);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + requestData.durationDays);

    const { data: mealPlan, error: insertError } = await supabaseClient
      .from('meal_plans')
      .insert({
        client_id: requestData.clientId,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        daily_calories: requestData.dailyCalories,
        meals_data: mealPlanData,
        shopping_list: mealPlanData.shopping_list,
        restrictions: requestData.restrictions,
        preferences: requestData.preferences,
        status: 'draft',
        ai_generated: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabaseClient.from('ai_requests').insert({
      user_id: user.id,
      request_type: 'meal_plan_generation',
      prompt: prompt.substring(0, 1000),
      response: responseText.substring(0, 1000),
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ mealPlan }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});