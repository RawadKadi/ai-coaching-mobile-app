import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.24.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CheckInAnalysisRequest {
  checkInId: string;
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

    const requestData: CheckInAnalysisRequest = await req.json();

    const { data: checkIn } = await supabaseClient
      .from('check_ins')
      .select('*, clients!inner(*, profiles(*))')
      .eq('id', requestData.checkInId)
      .single();

    if (!checkIn) {
      return new Response(
        JSON.stringify({ error: 'Check-in not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: recentCheckIns } = await supabaseClient
      .from('check_ins')
      .select('date, weight_kg, energy_level, stress_level, mood')
      .eq('client_id', checkIn.client_id)
      .order('date', { ascending: false })
      .limit(7);

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    });

    const prompt = `You are a wellness coach analyzing a client's daily check-in. Provide brief, actionable insights.

Today's Check-in:
- Weight: ${checkIn.weight_kg ? checkIn.weight_kg + ' kg' : 'Not recorded'}
- Sleep: ${checkIn.sleep_hours ? checkIn.sleep_hours + ' hours' : 'Not recorded'}
- Energy Level: ${checkIn.energy_level ? checkIn.energy_level + '/10' : 'Not recorded'}
- Stress Level: ${checkIn.stress_level ? checkIn.stress_level + '/10' : 'Not recorded'}
- Hunger Level: ${checkIn.hunger_level ? checkIn.hunger_level + '/10' : 'Not recorded'}
- Mood: ${checkIn.mood || 'Not recorded'}
- Notes: ${checkIn.notes || 'None'}

Recent Trend (past week):
${recentCheckIns?.map(ci => `- ${ci.date}: Weight ${ci.weight_kg}kg, Energy ${ci.energy_level}/10, Stress ${ci.stress_level}/10`).join('\n')}

Provide:
1. A brief analysis (2-3 sentences)
2. One specific recommendation
3. Words of encouragement

Keep it motivating, supportive, and under 150 words total.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

    const { error: updateError } = await supabaseClient
      .from('check_ins')
      .update({ ai_analysis: analysis })
      .eq('id', requestData.checkInId);

    if (updateError) throw updateError;

    await supabaseClient.from('ai_requests').insert({
      user_id: user.id,
      request_type: 'check_in_analysis',
      prompt: prompt.substring(0, 1000),
      response: analysis,
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ analysis }),
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