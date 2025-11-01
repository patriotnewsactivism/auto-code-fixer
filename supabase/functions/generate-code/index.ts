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

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    console.log('Generating code for task:', task.title);

    // Advanced prompt for autonomous code generation
    const systemPrompt = `You are an expert autonomous coding agent. Your task is to generate complete, production-ready code based on the user's request.

CRITICAL INSTRUCTIONS:
1. Generate COMPLETE, working code files - not snippets or examples
2. Return your response as a JSON array of files
3. Each file must have: filepath, content, language
4. Include ALL necessary files (components, hooks, utils, types, etc.)
5. Use modern best practices and TypeScript
6. Add proper error handling and validation
7. Make code production-ready with comments

RESPONSE FORMAT (MUST BE VALID JSON):
{
  "files": [
    {
      "filepath": "src/components/Example.tsx",
      "content": "import React from 'react';\\n\\nconst Example = () => {\\n  return <div>Hello</div>;\\n};\\n\\nexport default Example;",
      "language": "typescript"
    }
  ],
  "explanation": "Brief explanation of what was generated"
}

Task: ${task.description}`;

    // Call Google Gemini for code generation
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: systemPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
          }
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const rawResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawResponse) {
      throw new Error('No response from AI');
    }

    console.log('Raw AI response:', rawResponse);

    // Parse the JSON response (handle markdown code blocks)
    let parsedResponse;
    try {
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1].trim() : rawResponse.trim();
      parsedResponse = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback: create a single file with the raw response
      parsedResponse = {
        files: [{
          filepath: 'generated-code.txt',
          content: rawResponse,
          language: 'text'
        }],
        explanation: 'Generated code (parsing failed, showing raw output)'
      };
    }

    // Save generated files to database
    const filesToInsert = parsedResponse.files.map((file: any) => ({
      task_id: taskId,
      user_id: user.id,
      file_path: file.filepath,
      file_content: file.content,
      language: file.language || 'typescript',
      status: 'draft',
    }));

    const { error: insertError } = await supabaseClient
      .from('generated_code')
      .insert(filesToInsert);

    if (insertError) {
      console.error('Error saving generated code:', insertError);
      throw insertError;
    }

    // Update task with file count
    await supabaseClient
      .from('tasks')
      .update({ 
        generated_files_count: parsedResponse.files.length,
        result: parsedResponse.explanation || 'Code generated successfully'
      })
      .eq('id', taskId);

    // Log success
    await supabaseClient
      .from('execution_logs')
      .insert({
        task_id: taskId,
        agent_id: null,
        log_type: 'success',
        message: `Generated ${parsedResponse.files.length} files: ${parsedResponse.files.map((f: any) => f.filepath).join(', ')}`,
      });

    console.log('Code generation complete:', parsedResponse.files.length, 'files');

    return new Response(
      JSON.stringify({ 
        success: true, 
        filesGenerated: parsedResponse.files.length,
        files: parsedResponse.files,
        explanation: parsedResponse.explanation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-code function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
