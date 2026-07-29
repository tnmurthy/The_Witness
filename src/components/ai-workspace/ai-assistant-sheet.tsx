"use client";

import * as React from "react";
import { Wand2, Copy } from "lucide-react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Muted } from "@/components/ui/typography";

const FUNCTIONS = [
  { id: "rewrite", label: "Rewrite" },
  { id: "summarize", label: "Summarize" },
  { id: "improve_writing", label: "Improve Writing" },
  { id: "suggest_headlines", label: "Suggest Headlines" },
  { id: "suggest_images", label: "Suggest Images" },
  { id: "generate_linkedin_post", label: "Generate LinkedIn Post" },
  { id: "generate_email", label: "Generate Email" },
  { id: "generate_pdf_content", label: "Generate PDF Content" },
  { id: "generate_seo_metadata", label: "Generate SEO Metadata" },
] as const;

type FunctionId = (typeof FUNCTIONS)[number]["id"];

function buildInput(functionId: FunctionId, text: string, publicationName: string): Record<string, unknown> {
  switch (functionId) {
    case "rewrite":
      return { text, instruction: "Rewrite this to be clearer and more engaging, keeping the same meaning." };
    case "summarize":
      return { text, targetLength: "short_paragraph" };
    case "improve_writing":
      return { text };
    case "suggest_headlines":
      return { content: text, count: 5 };
    case "suggest_images":
      return { content: text, count: 3 };
    case "generate_linkedin_post":
      return { content: text };
    case "generate_email":
      return { content: text, publicationName };
    case "generate_pdf_content":
      return { content: text, publicationName };
    case "generate_seo_metadata":
      return { content: text };
  }
}

function formatOutput(functionId: FunctionId, output: unknown): string {
  if (typeof output === "string") return output;
  if (functionId === "improve_writing") {
    const o = output as { improvedText: string; changes: string[] };
    return `${o.improvedText}\n\n— Changes —\n${o.changes.map((c) => `• ${c}`).join("\n")}`;
  }
  if (functionId === "suggest_headlines") {
    return (output as { headlines: string[] }).headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
  }
  if (functionId === "suggest_images") {
    return (
      output as { suggestions: { searchQuery: string; altText: string; rationale: string }[] }
    ).suggestions
      .map((s) => `Search: "${s.searchQuery}"\nAlt text: ${s.altText}\nWhy: ${s.rationale}`)
      .join("\n\n");
  }
  if (functionId === "generate_email") {
    const o = output as { subject: string; previewText: string; body: string };
    return `Subject: ${o.subject}\nPreview: ${o.previewText}\n\n${o.body}`;
  }
  if (functionId === "generate_seo_metadata") {
    const o = output as {
      metaTitle: string;
      metaDescription: string;
      keywords: string[];
      ogTitle: string;
      ogDescription: string;
    };
    return `Meta title: ${o.metaTitle}\nMeta description: ${o.metaDescription}\nKeywords: ${o.keywords.join(", ")}\n\nOG title: ${o.ogTitle}\nOG description: ${o.ogDescription}`;
  }
  if (functionId === "generate_pdf_content") {
    const o = output as {
      coverTitle: string;
      coverSubtitle: string;
      pullQuote: string;
      sections: { heading: string; body: string }[];
    };
    return `${o.coverTitle}\n${o.coverSubtitle}\n\nPull quote: "${o.pullQuote}"\n\n${o.sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n")}`;
  }
  return JSON.stringify(output, null, 2);
}

interface AIAssistantSheetProps {
  publicationId: string;
  publicationName: string;
  issueId?: string;
  initialText?: string;
}

export function AIAssistantSheet({
  publicationId,
  publicationName,
  issueId,
  initialText = "",
}: AIAssistantSheetProps) {
  const [functionId, setFunctionId] = React.useState<FunctionId>("rewrite");
  const [inputText, setInputText] = React.useState(initialText);
  const [output, setOutput] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  async function handleRun() {
    if (!inputText.trim()) return;
    setIsRunning(true);
    setOutput(null);

    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionId,
          publicationId,
          issueId,
          input: buildInput(functionId, inputText, publicationName),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "AI function failed");

      setOutput(formatOutput(functionId, body.output));
    } catch (error) {
      logger.error("AI assistant run failed in UI", { error, functionId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsRunning(false);
    }
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Wand2 className="h-4 w-4" /> AI Assistant
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>AI Assistant</SheetTitle>
          <SheetDescription>
            Every result here is a suggestion — nothing is applied until you copy it in.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-function">Function</Label>
            <Select value={functionId} onValueChange={(v) => setFunctionId(v as FunctionId)}>
              <SelectTrigger id="ai-function">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNCTIONS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-input">Content</Label>
            <Textarea
              id="ai-input"
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type the text to work from…"
            />
          </div>

          <Button onClick={handleRun} disabled={isRunning || !inputText.trim()} className="w-full">
            {isRunning ? "Running…" : "Run"}
          </Button>

          {output && (
            <div className="space-y-2 rounded-md border border-neutral-200 bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <Muted className="text-xs font-semibold uppercase tracking-wide">Result</Muted>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{output}</pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
