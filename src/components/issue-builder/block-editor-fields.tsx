"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ImplementedBlockType } from "@/lib/blocks/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface BlockEditorFieldsProps {
  type: string;
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}

function set(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return { ...payload, ...patch };
}

function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

/**
 * Edit-mode form fields for every implemented block type — the
 * counterpart to block-renderer.tsx's read-mode switch. Every onChange
 * calls the parent's `onChange` with the full next payload object; the
 * parent (BlockCard) owns debouncing the actual autosave PATCH, so this
 * component stays a pure, uncontrolled-feeling form with no network
 * awareness of its own.
 */
export function BlockEditorFields({ type, payload, onChange }: BlockEditorFieldsProps) {
  switch (type as ImplementedBlockType) {
    case "heading":
      return (
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Heading text"
            value={(payload.text as string) ?? ""}
            onChange={(e) => onChange(set(payload, { text: e.target.value }))}
          />
          <Select value={String(payload.level ?? 2)} onValueChange={(v) => onChange(set(payload, { level: Number(v) }))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Level 1</SelectItem>
              <SelectItem value="2">Level 2</SelectItem>
              <SelectItem value="3">Level 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "paragraph":
      return (
        <Textarea
          autoFocus
          rows={4}
          placeholder="Write a paragraph…"
          value={(payload.text as string) ?? ""}
          onChange={(e) => onChange(set(payload, { text: e.target.value }))}
        />
      );

    case "image":
      return (
        <div className="space-y-2">
          <Input autoFocus placeholder="Image URL" value={(payload.url as string) ?? ""} onChange={(e) => onChange(set(payload, { url: e.target.value }))} />
          <Input
            placeholder="Alt text (required for accessibility)"
            value={(payload.alt as string) ?? ""}
            onChange={(e) => onChange(set(payload, { alt: e.target.value }))}
          />
          <Input placeholder="Caption (optional)" value={(payload.caption as string) ?? ""} onChange={(e) => onChange(set(payload, { caption: e.target.value }))} />
        </div>
      );

    case "table_block": {
      const headers = (payload.headers as string[]) ?? [];
      const rows = (payload.rows as string[][]) ?? [];
      return (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto">
            {headers.map((h, ci) => (
              <Input
                key={ci}
                className="w-32 shrink-0 font-medium"
                value={h}
                onChange={(e) => onChange(set(payload, { headers: headers.map((hh, i) => (i === ci ? e.target.value : hh)) }))}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(set(payload, { headers: [...headers, `Column ${headers.length + 1}`], rows: rows.map((r) => [...r, ""]) }))}
            >
              <Plus className="h-3.5 w-3.5" /> Column
            </Button>
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-2 overflow-x-auto">
              {row.map((cell, ci) => (
                <Input
                  key={ci}
                  className="w-32 shrink-0"
                  value={cell}
                  onChange={(e) =>
                    onChange(set(payload, { rows: rows.map((r, i) => (i === ri ? r.map((c, ci2) => (ci2 === ci ? e.target.value : c)) : r)) }))
                  }
                />
              ))}
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => onChange(set(payload, { rows: rows.filter((_, i) => i !== ri) }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(set(payload, { rows: [...rows, headers.map(() => "")] }))}>
            <Plus className="h-3.5 w-3.5" /> Row
          </Button>
        </div>
      );
    }

    case "hero_story":
      return (
        <div className="space-y-2">
          <Input placeholder="Eyebrow (optional)" value={(payload.eyebrow as string) ?? ""} onChange={(e) => onChange(set(payload, { eyebrow: e.target.value }))} />
          <Input autoFocus placeholder="Headline" value={(payload.headline as string) ?? ""} onChange={(e) => onChange(set(payload, { headline: e.target.value }))} />
          <Input placeholder="Dek (optional subhead)" value={(payload.dek as string) ?? ""} onChange={(e) => onChange(set(payload, { dek: e.target.value }))} />
          <Input placeholder="Image URL (optional)" value={(payload.imageUrl as string) ?? ""} onChange={(e) => onChange(set(payload, { imageUrl: e.target.value }))} />
          <Textarea rows={6} placeholder="Body" value={(payload.body as string) ?? ""} onChange={(e) => onChange(set(payload, { body: e.target.value }))} />
        </div>
      );

    case "signal_card":
      return (
        <div className="space-y-2">
          <Input placeholder="Eyebrow" value={(payload.eyebrow as string) ?? "Signal"} onChange={(e) => onChange(set(payload, { eyebrow: e.target.value }))} />
          <Input autoFocus placeholder="Headline" value={(payload.headline as string) ?? ""} onChange={(e) => onChange(set(payload, { headline: e.target.value }))} />
          <Textarea rows={4} placeholder="Body" value={(payload.body as string) ?? ""} onChange={(e) => onChange(set(payload, { body: e.target.value }))} />
        </div>
      );

    case "career_insight":
      return (
        <div className="space-y-2">
          <Input autoFocus placeholder="Headline" value={(payload.headline as string) ?? ""} onChange={(e) => onChange(set(payload, { headline: e.target.value }))} />
          <Textarea rows={4} placeholder="Body" value={(payload.body as string) ?? ""} onChange={(e) => onChange(set(payload, { body: e.target.value }))} />
          <StringListEditor label="Action items" items={(payload.actionItems as string[]) ?? []} onChange={(items) => onChange(set(payload, { actionItems: items }))} />
        </div>
      );

    case "research_summary":
      return (
        <div className="space-y-2">
          <Input autoFocus placeholder="Paper title" value={(payload.title as string) ?? ""} onChange={(e) => onChange(set(payload, { title: e.target.value }))} />
          <Input placeholder="Authors" value={(payload.authors as string) ?? ""} onChange={(e) => onChange(set(payload, { authors: e.target.value }))} />
          <Input placeholder="URL" value={(payload.url as string) ?? ""} onChange={(e) => onChange(set(payload, { url: e.target.value }))} />
          <Textarea rows={4} placeholder="Summary" value={(payload.summary as string) ?? ""} onChange={(e) => onChange(set(payload, { summary: e.target.value }))} />
        </div>
      );

    case "github_repository_block":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input autoFocus placeholder="owner" value={(payload.owner as string) ?? ""} onChange={(e) => onChange(set(payload, { owner: e.target.value }))} />
            <Input placeholder="repo" value={(payload.repo as string) ?? ""} onChange={(e) => onChange(set(payload, { repo: e.target.value }))} />
          </div>
          <Input placeholder="https://github.com/owner/repo" value={(payload.url as string) ?? ""} onChange={(e) => onChange(set(payload, { url: e.target.value }))} />
          <Textarea rows={3} placeholder="Description (optional)" value={(payload.description as string) ?? ""} onChange={(e) => onChange(set(payload, { description: e.target.value }))} />
        </div>
      );

    case "company_profile":
      return (
        <div className="space-y-2">
          <Input autoFocus placeholder="Company name" value={(payload.name as string) ?? ""} onChange={(e) => onChange(set(payload, { name: e.target.value }))} />
          <Input placeholder="Website URL" value={(payload.url as string) ?? ""} onChange={(e) => onChange(set(payload, { url: e.target.value }))} />
          <Textarea rows={4} placeholder="Description" value={(payload.description as string) ?? ""} onChange={(e) => onChange(set(payload, { description: e.target.value }))} />
        </div>
      );

    case "timeline": {
      const events = (payload.events as { date: string; title: string; description?: string }[]) ?? [];
      return (
        <div className="space-y-3">
          {events.map((ev, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-neutral-200 p-3">
              <div className="flex gap-2">
                <Input
                  className="w-32"
                  placeholder="Date"
                  value={ev.date}
                  onChange={(e) => onChange(set(payload, { events: events.map((x, idx) => (idx === i ? { ...x, date: e.target.value } : x)) }))}
                />
                <Input
                  placeholder="Event title"
                  value={ev.title}
                  onChange={(e) => onChange(set(payload, { events: events.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)) }))}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove event" onClick={() => onChange(set(payload, { events: events.filter((_, idx) => idx !== i) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Description (optional)"
                value={ev.description ?? ""}
                onChange={(e) => onChange(set(payload, { events: events.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)) }))}
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(set(payload, { events: [...events, { date: "", title: "" }] }))}>
            <Plus className="h-3.5 w-3.5" /> Add event
          </Button>
        </div>
      );
    }

    case "quote":
      return (
        <div className="space-y-2">
          <Textarea autoFocus rows={3} placeholder="Quote text" value={(payload.text as string) ?? ""} onChange={(e) => onChange(set(payload, { text: e.target.value }))} />
          <Input placeholder="Attribution (optional)" value={(payload.attribution as string) ?? ""} onChange={(e) => onChange(set(payload, { attribution: e.target.value }))} />
        </div>
      );

    case "reflection":
      return (
        <div className="space-y-2">
          <Textarea autoFocus rows={2} placeholder="Reflection question" value={(payload.question as string) ?? ""} onChange={(e) => onChange(set(payload, { question: e.target.value }))} />
          <Textarea rows={2} placeholder="Prompt / help text (optional)" value={(payload.promptHelp as string) ?? ""} onChange={(e) => onChange(set(payload, { promptHelp: e.target.value }))} />
        </div>
      );

    case "todays_wisdom":
      return (
        <div className="space-y-2">
          <Textarea placeholder="Source text (original language, optional)" rows={2} value={(payload.sourceText as string) ?? ""} onChange={(e) => onChange(set(payload, { sourceText: e.target.value }))} />
          <Input placeholder="IAST transliteration (optional)" value={(payload.iast as string) ?? ""} onChange={(e) => onChange(set(payload, { iast: e.target.value }))} />
          <Textarea autoFocus rows={2} placeholder="Translation" value={(payload.translation as string) ?? ""} onChange={(e) => onChange(set(payload, { translation: e.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="Source (e.g. Bhagavad Gītā 2.47)" value={(payload.source as string) ?? ""} onChange={(e) => onChange(set(payload, { source: e.target.value }))} />
            <Input placeholder="Context (optional)" value={(payload.context as string) ?? ""} onChange={(e) => onChange(set(payload, { context: e.target.value }))} />
          </div>
        </div>
      );

    case "action_checklist": {
      const items = (payload.items as { text: string; done: boolean }[]) ?? [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                checked={item.done}
                onCheckedChange={(checked) => onChange(set(payload, { items: items.map((x, idx) => (idx === i ? { ...x, done: !!checked } : x)) }))}
              />
              <Input value={item.text} onChange={(e) => onChange(set(payload, { items: items.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)) }))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => onChange(set(payload, { items: items.filter((_, idx) => idx !== i) }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(set(payload, { items: [...items, { text: "", done: false }] }))}>
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        </div>
      );
    }

    default:
      return <p className="text-sm text-muted-foreground">This block type doesn&apos;t have an editor yet.</p>;
  }
}
