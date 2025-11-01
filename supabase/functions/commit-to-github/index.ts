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

    const { taskId, commitMessage } = await req.json();

    // Get GitHub repo info
    const { data: githubRepo, error: repoError } = await supabaseClient
      .from('github_repos')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (repoError || !githubRepo) {
      throw new Error('GitHub repository not connected. Please connect your repository first.');
    }

    // Get generated code files for this task
    const { data: files, error: filesError } = await supabaseClient
      .from('generated_code')
      .select('*')
      .eq('task_id', taskId)
      .eq('status', 'draft');

    if (filesError || !files || files.length === 0) {
      throw new Error('No generated code files found for this task');
    }

    console.log(`Committing ${files.length} files to GitHub`);

    // GitHub API: Get the latest commit SHA
    const repoFullName = githubRepo.repo_name;
    const branch = githubRepo.default_branch;

    const refResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        headers: {
          'Authorization': `token ${githubRepo.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!refResponse.ok) {
      throw new Error(`Failed to get branch ref: ${await refResponse.text()}`);
    }

    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    // Get the tree SHA from the latest commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits/${latestCommitSha}`,
      {
        headers: {
          'Authorization': `token ${githubRepo.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!commitResponse.ok) {
      throw new Error(`Failed to get commit: ${await commitResponse.text()}`);
    }

    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${repoFullName}/git/blobs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${githubRepo.access_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: file.file_content,
              encoding: 'utf-8',
            }),
          }
        );

        if (!blobResponse.ok) {
          throw new Error(`Failed to create blob: ${await blobResponse.text()}`);
        }

        const blobData = await blobResponse.json();
        return {
          path: file.file_path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      })
    );

    // Create a new tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubRepo.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs,
        }),
      }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to create tree: ${await treeResponse.text()}`);
    }

    const treeData = await treeResponse.json();

    // Create a new commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubRepo.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage || `AI Agent: Generated code for task`,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error(`Failed to create commit: ${await newCommitResponse.text()}`);
    }

    const newCommitData = await newCommitResponse.json();

    // Update the reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubRepo.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    if (!updateRefResponse.ok) {
      throw new Error(`Failed to update ref: ${await updateRefResponse.text()}`);
    }

    // Mark files as committed
    await supabaseClient
      .from('generated_code')
      .update({ status: 'committed' })
      .in('id', files.map(f => f.id));

    // Update task with commit SHA
    await supabaseClient
      .from('tasks')
      .update({ github_commit_sha: newCommitData.sha })
      .eq('id', taskId);

    // Log success
    await supabaseClient
      .from('execution_logs')
      .insert({
        task_id: taskId,
        agent_id: null,
        log_type: 'success',
        message: `Committed ${files.length} files to GitHub. Commit: ${newCommitData.sha.substring(0, 7)}`,
      });

    console.log('GitHub commit successful:', newCommitData.sha);

    return new Response(
      JSON.stringify({ 
        success: true, 
        commitSha: newCommitData.sha,
        commitUrl: newCommitData.html_url,
        filesCommitted: files.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in commit-to-github function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
