import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Github, CheckCircle, ExternalLink } from "lucide-react";

interface GitHubSetupProps {
  userId: string;
}

export const GitHubSetup = ({ userId }: GitHubSetupProps) => {
  const [connected, setConnected] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } = await supabase
        .from("github_repos")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data && !error) {
        setConnected(true);
        setRepoName(data.repo_name);
        setRepoUrl(data.repo_url);
      }
    };

    checkConnection();
  }, [userId]);

  const handleSave = async () => {
    if (!repoName || !accessToken) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("github_repos").upsert({
        user_id: userId,
        repo_name: repoName,
        repo_url: `https://github.com/${repoName}`,
        access_token: accessToken,
        default_branch: "main",
      });

      if (error) throw error;

      setConnected(true);
      setRepoUrl(`https://github.com/${repoName}`);
      toast({
        title: "Success!",
        description: "GitHub repository connected",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (connected) {
    return (
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2">
              <Github className="h-4 w-4" />
              GitHub Connected
            </h3>
            <p className="text-sm text-muted-foreground">{repoName}</p>
          </div>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            <span className="text-sm">View Repo</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <h3 className="font-semibold">Connect GitHub Repository</h3>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-2">
              Enable autonomous code commits to your GitHub repository.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Create a GitHub Personal Access Token (classic)</li>
              <li>Grant repo permissions (full control)</li>
              <li>Enter your repository name (e.g., username/repo-name)</li>
              <li>Paste your access token</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Repository Name (owner/repo)
              </label>
              <Input
                placeholder="username/repository-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Personal Access Token
              </label>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              >
                Create token on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Connecting..." : "Connect Repository"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
