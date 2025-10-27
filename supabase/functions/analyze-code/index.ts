import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Keep existing CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- MODIFICATION: Use Google API Key ---
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not configured in Supabase secrets.');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- END MODIFICATION ---

    // Define the system prompt for code analysis (keep or adjust as needed)
    const systemPrompt = `You are an expert code analyzer and fixer. Analyze the provided code for:
1. Syntax errors
2. Logic errors
3. Security vulnerabilities
4. Performance issues
5. Best practice violations
6. Code quality improvements

Return ONLY a valid JSON object (no markdown formatting like \`\`\`json) with this exact structure:
{
  "issues": [
    {
      "type": "error|warning|suggestion",
      "category": "syntax|logic|security|performance|quality",
      "line": number | null, // Use null if line number is not applicable
      "description": "detailed description",
      "severity": "critical|high|medium|low"
    }
  ],
  "fixedCode": "the corrected code with all issues fixed",
  "summary": "brief summary of changes made"
}`;

    // --- MODIFICATION: Call Google Gemini API ---
    // Using gemini-1.5-flash model - adjust if needed
    const model = "gemini-1.5-flash"; // Or another available model
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Gemini API expects 'contents', not 'messages'
        contents: [
          {
            role: 'user', // Gemini uses 'user' and 'model' roles
            parts: [
              { text: systemPrompt }, // Include system prompt as part of the user message
              { text: `Analyze and fix this code:\n\n${code}` }
            ]
          }
        ],
        // Optional: Add generationConfig if needed (temperature, maxOutputTokens, etc.)
        // generationConfig: {
        //   responseMimeType: "application/json", // Request JSON output directly
        //   temperature: 0.7,
        //   maxOutputTokens: 8192,
        // }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
       // Add specific error handling for Google API if needed (e.g., billing issues, quota exceeded)
      return new Response(
        JSON.stringify({ error: 'AI service error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // *** IMPORTANT: Parse Gemini API response structure ***
    // This structure might vary slightly, check Google AI documentation
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!result) {
      console.error('Failed to extract content from Gemini response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'AI service returned unexpected response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- END MODIFICATION ---

    // Try to parse the JSON response (keep this part)
    let parsedResult;
    try {
      // Gemini might return JSON directly, or sometimes wrapped in markdown
      const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1].trim() : result.trim();
      parsedResult = JSON.parse(jsonContent);

       // Basic validation of expected structure
       if (!parsedResult || typeof parsedResult !== 'object' || !Array.isArray(parsedResult.issues) || typeof parsedResult.fixedCode !== 'string') {
          throw new Error("Parsed JSON does not match expected structure.");
       }

    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e, 'Raw response:', result);
      // Fallback if JSON parsing fails
      parsedResult = {
        issues: [{
            type: "error",
            category: "parsing",
            line: null,
            description: `Failed to parse AI response. Raw output: ${result}`,
            severity: "critical"
        }],
        fixedCode: code, // Return original code on failure
        summary: "Error: Could not process AI response."
      };
      // Optionally, you could return an error response here instead of a fallback
      // return new Response(
      //   JSON.stringify({ error: 'Failed to parse AI response', details: e.message, rawOutput: result }),
      //   { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      // );
    }

    // Return the successfully parsed or fallback result
    return new Response(
      JSON.stringify(parsedResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-code function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
