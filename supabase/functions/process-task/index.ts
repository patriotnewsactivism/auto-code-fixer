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

    // Simulate AI processing (in production, this would call actual AI APIs)
    // For now, we'll just mark it as completed after a delay
    setTimeout(async () => {
      await supabaseClient
        .from('tasks')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      await supabaseClient
        .from('agents')
        .update({ status: 'idle', current_task_id: null })
        .eq('id', agent!.id);

      await supabaseClient
        .from('execution_logs')
        .insert({
          task_id: taskId,
          agent_id: agent!.id,
          log_type: 'success',
          message: `Completed task: ${task.title}`,
        });
    }, 5000);

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
