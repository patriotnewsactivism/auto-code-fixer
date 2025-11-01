import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Code, Copy, Download, Github, CheckCircle } from "lucide-react";

interface GeneratedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string;
  status: string;
  created_at: string;
}

interface CodePreviewProps {
  taskId: string;
  userId: string;
}

export const CodePreview = ({ taskId, userId }: CodePreviewProps) => {
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      const { data, error } = await supabase
        .from("generated_code")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching files:", error);
        return;
      }

      if (data && data.length > 0) {
        setFiles(data);
        setSelectedFile(data[0].id);
      }
    };

    fetchFiles();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("generated-code-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generated_code",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitToGithub = async () => {
    setCommitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("commit-to-github", {
        body: { 
          taskId,
          commitMessage: `AI Agent: Auto-generated code for task ${taskId.substring(0, 8)}`
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Committed ${data.filesCommitted} files to GitHub`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCommitting(false);
    }
  };

  if (files.length === 0) {
    return (
      <Card className="p-8 text-center bg-card border-border">
        <Code className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold mb-2">No Code Generated Yet</h3>
        <p className="text-sm text-muted-foreground">
          Start the system and submit a task to see generated code here
        </p>
      </Card>
    );
  }

  const selectedFileData = files.find((f) => f.id === selectedFile);
  const hasDraftFiles = files.some((f) => f.status === "draft");

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <h3 className="font-semibold">Generated Code ({files.length} files)</h3>
        </div>
        {hasDraftFiles && (
          <Button
            onClick={commitToGithub}
            disabled={committing}
            size="sm"
            className="gap-2"
          >
            <Github className="h-4 w-4" />
            {committing ? "Committing..." : "Commit to GitHub"}
          </Button>
        )}
      </div>

      <Tabs value={selectedFile || undefined} onValueChange={setSelectedFile}>
        <div className="mb-4 overflow-x-auto">
          <TabsList className="inline-flex">
            {files.map((file) => (
              <TabsTrigger key={file.id} value={file.id} className="gap-2">
                <span className="max-w-[150px] truncate">
                  {file.file_path.split("/").pop()}
                </span>
                {file.status === "committed" && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {selectedFileData && (
          <TabsContent value={selectedFileData.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedFileData.language}</Badge>
                <Badge variant={selectedFileData.status === "committed" ? "default" : "secondary"}>
                  {selectedFileData.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedFileData.file_path}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(selectedFileData.file_content)}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadFile(
                      selectedFileData.file_path.split("/").pop() || "file.txt",
                      selectedFileData.file_content
                    )
                  }
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-secondary rounded-lg p-4 overflow-x-auto text-sm">
                <code>{selectedFileData.file_content}</code>
              </pre>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
};
