import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConfigDialog = ({ open, onOpenChange }: ConfigDialogProps) => {
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");

  const providers = [
    { value: "groq", label: "Groq (FREE)" },
    { value: "gemini", label: "Google Gemini" },
    { value: "huggingface", label: "HuggingFace" },
    { value: "cohere", label: "Cohere" },
    { value: "claude", label: "Anthropic Claude" },
    { value: "openai", label: "OpenAI" },
    { value: "ollama", label: "Ollama (Local)" },
  ];

  const handleSave = () => {
    if (!apiKey && provider !== "ollama") {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Settings Saved",
      description: `Configuration saved for ${provider}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>AI Provider Configuration</DialogTitle>
          <DialogDescription>
            Configure your AI provider and API key to start using the system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider !== "ollama" && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from the provider's website
              </p>
            </div>
          )}

          {provider === "ollama" && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">
                <strong>Local Operation:</strong> Ollama runs entirely on your machine.
                Make sure you have Ollama installed and running.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
