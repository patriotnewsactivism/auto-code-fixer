import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { taskId } = await req.json();

    // Get task details
    const { data: task, error: taskError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      throw new Error('Task not found');
    }

    // Update task status to processing
    await supabaseClient
      .from('tasks')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    // Get or create an idle agent
    let { data: agent } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'idle')
      .limit(1)
      .single();

    if (!agent) {
      // Create a new agent if none available
      const { data: newAgent } = await supabaseClient
        .from('agents')
        .insert({
          name: `Agent-${Date.now()}`,
          type: 'code-generator',
          status: 'active',
          current_task_id: taskId,
          user_id: user.id,
        })
        .select()
        .single();
      agent = newAgent;
    } else {
      // Update agent status
      await supabaseClient
        .from('agents')
        .update({ status: 'active', current_task_id: taskId })
        .eq('id', agent.id);
    }

    // Log the task processing start
    await supabaseClient
      .from('execution_logs')
      .insert({
        task_id: taskId,
        agent_id: agent!.id,
        log_type: 'info',
        message: `Started processing task: ${task.title}`,
      });

    // Process the task with AI
    try {
      const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
      if (!GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY not configured');
      }

      // Call Google Gemini API for code analysis/generation
      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ 
                text: `You are an autonomous coding assistant. Analyze this task and provide a solution:\n\n${task.description}\n\nProvide a detailed response including:\n1. Analysis of the task\n2. Proposed solution\n3. Code implementation (if applicable)\n4. Testing recommendations` 
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          }),
        }
      );

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${await aiResponse.text()}`);
      }

      const aiData = await aiResponse.json();
      const result = aiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

      // Log AI response
      await supabaseClient
        .from('execution_logs')
        .insert({
          task_id: taskId,
          agent_id: agent!.id,
          log_type: 'info',
          message: `AI Response: ${result.substring(0, 500)}...`,
        });

      // Mark task as completed
      await supabaseClient
        .from('tasks')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString(),
          result: result 
        })
        .eq('id', taskId);

      // Track API usage (rough estimate)
      await supabaseClient
        .from('api_usage')
        .insert({
          user_id: user.id,
          task_id: taskId,
          model: 'gemini-1.5-flash',
          tokens_used: Math.ceil(result.length / 4),
          estimated_cost: 0.001, // Rough estimate
        });

    } catch (error) {
      console.error('Task processing error:', error);
      
      await supabaseClient
        .from('tasks')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      await supabaseClient
        .from('execution_logs')
        .insert({
          task_id: taskId,
          agent_id: agent!.id,
          log_type: 'error',
          message: `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    } finally {
      // Reset agent to idle
      await supabaseClient
        .from('agents')
        .update({ status: 'idle', current_task_id: null })
        .eq('id', agent!.id);
    }

    return new Response(
      JSON.stringify({ success: true, agentId: agent!.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
