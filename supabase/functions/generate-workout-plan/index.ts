import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WorkoutPlanRequest {
  clientId: string;
  goal: string;
  experienceLevel: string;
  equipment: string[];
  durationWeeks: number;
  daysPerWeek: number;
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

    const requestData: WorkoutPlanRequest = await req.json();

    const { data: client } = await supabaseClient
      .from('clients')
      .select('*')
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

    const prompt = `You are a certified personal trainer. Create a ${requestData.durationWeeks}-week workout plan.

Client Details:
- Goal: ${requestData.goal}
- Experience Level: ${requestData.experienceLevel}
- Available Equipment: ${requestData.equipment.join(', ') || 'Bodyweight only'}
- Days Per Week: ${requestData.daysPerWeek}

Provide a structured workout plan with:
1. Weekly workout schedule
2. Exercise details (sets, reps, rest periods)
3. Progressive overload strategy
4. Warm-up and cool-down routines

Format as JSON with this structure:
{
  "name": "Plan name",
  "weeks": [
    {
      "week": 1,
      "focus": "Week focus",
      "workouts": [
        {
          "day": "Monday",
          "name": "Workout name",
          "duration_minutes": 45,
          "exercises": [
            {
              "name": "Exercise name",
              "sets": 3,
              "reps": 10,
              "rest_seconds": 60,
              "notes": "Form tips"
            }
          ]
        }
      ]
    }
  ]
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
    const workoutPlanData = JSON.parse(responseText);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (requestData.durationWeeks * 7));

    const { data: workoutPlan, error: insertError } = await supabaseClient
      .from('workout_plans')
      .insert({
        client_id: requestData.clientId,
        name: workoutPlanData.name,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        goal: requestData.goal,
        experience_level: requestData.experienceLevel,
        equipment: requestData.equipment,
        weekly_schedule: workoutPlanData,
        status: 'draft',
        ai_generated: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabaseClient.from('ai_requests').insert({
      user_id: user.id,
      request_type: 'workout_plan_generation',
      prompt: prompt.substring(0, 1000),
      response: responseText.substring(0, 1000),
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ workoutPlan }),
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