"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Muted } from "@/components/ui/typography";

type Channel = "email" | "pdf" | "web";
const CHANNELS: { value: Channel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "pdf", label: "PDF" },
  { value: "web", label: "Website" },
];

function ChannelEditor({ publicationId, channel, initialConfig }: { publicationId: string; channel: Channel; initialConfig: Record<string, unknown> }) {
  const router = useRouter();
  const [text, setText] = React.useState(JSON.stringify(initialConfig, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("That's not valid JSON — check for a missing comma or bracket.");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/publications/${publicationId}/templates/${channel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save template");

      toast.success(`${channel.toUpperCase()} template saved`);
      router.refresh();
    } catch (err) {
      logger.error("Template config save failed in UI", { error: err, publicationId, channel });
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Muted>
        Raw template configuration, consumed by the {channel} rendering pipeline (Milestone 10). Structure is
        intentionally not fixed at the schema level — see docs/PUBLICATION_MANAGEMENT.md.
      </Muted>
      <div className="space-y-1.5">
        <Label htmlFor={`config-${channel}`}>Config (JSON)</Label>
        <Textarea
          id={`config-${channel}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="font-mono text-xs"
        />
      </div>
      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : `Save ${channel} template`}
      </Button>
    </div>
  );
}

interface TemplatesPanelProps {
  publicationId: string;
  initialConfigs: Record<Channel, Record<string, unknown>>;
}

export function TemplatesPanel({ publicationId, initialConfigs }: TemplatesPanelProps) {
  return (
    <Tabs defaultValue="email">
      <TabsList>
        {CHANNELS.map((c) => (
          <TabsTrigger key={c.value} value={c.value}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {CHANNELS.map((c) => (
        <TabsContent key={c.value} value={c.value}>
          <ChannelEditor publicationId={publicationId} channel={c.value} initialConfig={initialConfigs[c.value] ?? {}} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
