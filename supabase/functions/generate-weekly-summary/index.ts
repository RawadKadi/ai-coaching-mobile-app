import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WeeklySummaryRequest {
  clientId: string;
  coachId?: string;
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

    const requestData: WeeklySummaryRequest = await req.json();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const [checkInsResult, mealsResult, workoutsResult, habitLogsResult] = await Promise.all([
      supabaseClient
        .from('check_ins')
        .select('*')
        .eq('client_id', requestData.clientId)
        .gte('date', sevenDaysAgoStr)
        .order('date', { ascending: true }),
      supabaseClient
        .from('meals')
        .select('meal_type, calories, protein_g, carbs_g, fat_g')
        .eq('client_id', requestData.clientId)
        .gte('date', sevenDaysAgoStr),
      supabaseClient
        .from('workouts')
        .select('name, duration_minutes, completed')
        .eq('client_id', requestData.clientId)
        .gte('date', sevenDaysAgoStr),
      supabaseClient
        .from('habit_logs')
        .select('*, habits(name)')
        .eq('client_id', requestData.clientId)
        .gte('date', sevenDaysAgoStr),
    ]);

    const checkIns = checkInsResult.data || [];
    const meals = mealsResult.data || [];
    const workouts = workoutsResult.data || [];
    const habitLogs = habitLogsResult.data || [];

    let coachBrainContext = '';
    if (requestData.coachId) {
      const { data: coachBrain } = await supabaseClient
        .from('ai_coach_brains')
        .select('tone, style, philosophy, specialty_focus')
        .eq('coach_id', requestData.coachId)
        .maybeSingle();

      if (coachBrain) {
        coachBrainContext = `\n\nCoach's Style:\n- Tone: ${coachBrain.tone}\n- Style: ${coachBrain.style}\n- Philosophy: ${coachBrain.philosophy || 'Not specified'}\n- Focus: ${coachBrain.specialty_focus || 'General fitness'}`;
      }
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    const avgWeight = checkIns.reduce((sum, ci) => sum + (ci.weight_kg || 0), 0) / checkIns.length;
    const avgEnergy = checkIns.reduce((sum, ci) => sum + (ci.energy_level || 0), 0) / checkIns.length;
    const avgStress = checkIns.reduce((sum, ci) => sum + (ci.stress_level || 0), 0) / checkIns.length;
    const avgSleep = checkIns.reduce((sum, ci) => sum + (ci.sleep_hours || 0), 0) / checkIns.length;

    const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const avgDailyCalories = totalCalories / 7;
    const totalProtein = meals.reduce((sum, m) => sum + (m.protein_g || 0), 0);

    const completedWorkouts = workouts.filter(w => w.completed).length;
    const totalWorkoutMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);

    const completedHabits = habitLogs.filter(hl => hl.completed).length;
    const habitCompletionRate = habitLogs.length > 0 ? (completedHabits / habitLogs.length * 100).toFixed(0) : 0;

    const prompt = `You are a fitness and wellness coach analyzing a client's weekly performance. Create a comprehensive, motivating weekly summary.${coachBrainContext}

Weekly Data Summary:

Check-ins: ${checkIns.length} days
- Average Weight: ${avgWeight.toFixed(1)} kg
- Average Energy Level: ${avgEnergy.toFixed(1)}/10
- Average Stress Level: ${avgStress.toFixed(1)}/10
- Average Sleep: ${avgSleep.toFixed(1)} hours

Nutrition:
- Total Meals Logged: ${meals.length}
- Average Daily Calories: ${avgDailyCalories.toFixed(0)}
- Total Protein: ${totalProtein.toFixed(0)}g

Workouts:
- Completed Workouts: ${completedWorkouts}
- Total Workout Time: ${totalWorkoutMinutes} minutes

Habits:
- Completion Rate: ${habitCompletionRate}%
- Completed: ${completedHabits}/${habitLogs.length}

Provide:
1. Overview of the week (2-3 sentences)
2. Key wins and accomplishments
3. Areas for improvement
4. Specific recommendations for next week
5. Motivational message

Keep it personal, actionable, and encouraging. Maximum 300 words.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    await supabaseClient.from('ai_requests').insert({
      user_id: user.id,
      request_type: 'weekly_summary',
      prompt: prompt.substring(0, 1000),
      response: summary.substring(0, 1000),
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
      status: 'success',
    });

    return new Response(
      JSON.stringify({
        summary,
        stats: {
          checkIns: checkIns.length,
          avgWeight,
          avgEnergy,
          avgStress,
          avgSleep,
          avgDailyCalories,
          completedWorkouts,
          totalWorkoutMinutes,
          habitCompletionRate,
        },
      }),
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