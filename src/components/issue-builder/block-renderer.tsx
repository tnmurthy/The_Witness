import { Github, ExternalLink, CheckSquare, Square } from "lucide-react";
import type { ImplementedBlockType } from "@/lib/blocks/types";
import { H1, H2, H3, Text, Muted, Eyebrow } from "@/components/ui/typography";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type {
  HeadingPayload,
  ParagraphPayload,
  ImagePayload,
  TableBlockPayload,
  HeroStoryPayload,
  SignalCardPayload,
  CareerInsightPayload,
  ResearchSummaryPayload,
  GithubRepositoryBlockPayload,
  CompanyProfilePayload,
  TimelinePayload,
  QuotePayload,
  ReflectionPayload,
  TodaysWisdomPayload,
  ActionChecklistPayload,
} from "@/lib/blocks/schemas";

/**
 * Read-mode rendering for every implemented block type, one switch
 * rather than 15 files — see registry.ts for why this organization was
 * chosen over one-file-per-type. Visual treatments for Technology Signal
 * and Today's Wisdom match the standalone Design System deliverable's
 * Card section exactly (gold-700 left border for Signal, gold-50
 * background for Wisdom) — this is the same "signal" motif used for the
 * active nav indicator and required-field markers throughout the
 * product, applied here to its original, defining use case.
 *
 * Editorial images can come from any domain a writer pastes a URL from,
 * so image/hero_story deliberately use a plain <img>, not next/image's
 * remotePatterns-restricted Image component (reserved elsewhere in the
 * app for known/allowlisted domains like Supabase Storage — see
 * next.config.ts).
 */
export function BlockRenderer({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  switch (type as ImplementedBlockType) {
    case "heading": {
      const p = payload as unknown as HeadingPayload;
      if (p.level === 1) return <H1>{p.text}</H1>;
      if (p.level === 3) return <H3>{p.text}</H3>;
      return <H2>{p.text}</H2>;
    }

    case "paragraph": {
      const p = payload as unknown as ParagraphPayload;
      return <Text className="whitespace-pre-wrap leading-relaxed">{p.text}</Text>;
    }

    case "image": {
      const p = payload as unknown as ImagePayload;
      if (!p.url) return <EmptyBlockPlaceholder label="Image" />;
      return (
        <figure className="space-y-2">
          <div className="relative w-full overflow-hidden rounded-md border border-neutral-200 bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt} className="h-auto w-full object-cover" />
          </div>
          {p.caption && <figcaption className="text-xs text-muted-foreground">{p.caption}</figcaption>}
        </figure>
      );
    }

    case "table_block": {
      const p = payload as unknown as TableBlockPayload;
      return (
        <Table>
          <TableHeader>
            <TableRow>
              {p.headers.map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.rows.map((row, ri) => (
              <TableRow key={ri}>
                {row.map((cell, ci) => (
                  <TableCell key={ci}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    case "hero_story": {
      const p = payload as unknown as HeroStoryPayload;
      return (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-card p-6">
          {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
          <h2 className="font-voice text-3xl font-semibold leading-tight text-foreground">{p.headline || "Untitled hero story"}</h2>
          {p.dek && <p className="text-lg text-muted-foreground">{p.dek}</p>}
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="w-full rounded-md object-cover" />
          )}
          <Text className="whitespace-pre-wrap leading-relaxed">{p.body}</Text>
        </div>
      );
    }

    case "signal_card": {
      const p = payload as unknown as SignalCardPayload;
      return (
        <div className="rounded-sm border-l-4 border-gold-700 bg-card p-5">
          <Eyebrow>{p.eyebrow || "Signal"}</Eyebrow>
          <h4 className="mt-1 font-voice text-lg font-semibold text-foreground">{p.headline || "Untitled signal"}</h4>
          <Text className="mt-1 text-sm text-muted-foreground">{p.body}</Text>
        </div>
      );
    }

    case "career_insight": {
      const p = payload as unknown as CareerInsightPayload;
      return (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-card p-5">
          <Badge variant="info">Career Insight</Badge>
          <h4 className="font-semibold text-foreground">{p.headline || "Untitled insight"}</h4>
          <Text className="text-sm">{p.body}</Text>
          {p.actionItems.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {p.actionItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    case "research_summary": {
      const p = payload as unknown as ResearchSummaryPayload;
      return (
        <div className="space-y-1.5 rounded-lg border border-neutral-200 bg-card p-5">
          <Badge variant="neutral">Research Paper</Badge>
          <h4 className="font-semibold text-foreground">{p.title || "Untitled paper"}</h4>
          {p.authors && <Muted>{p.authors}</Muted>}
          <Text className="text-sm">{p.summary}</Text>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-navy-700 hover:underline">
              Read paper <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }

    case "github_repository_block": {
      const p = payload as unknown as GithubRepositoryBlockPayload;
      return (
        <a
          href={p.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-card p-5 transition-colors hover:border-neutral-300"
        >
          <Github className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              {p.owner}/{p.repo}
            </p>
            {p.description && <Text className="mt-1 text-sm text-muted-foreground">{p.description}</Text>}
          </div>
        </a>
      );
    }

    case "company_profile": {
      const p = payload as unknown as CompanyProfilePayload;
      return (
        <div className="space-y-1.5 rounded-lg border border-neutral-200 bg-card p-5">
          <h4 className="font-semibold text-foreground">{p.name || "Untitled company"}</h4>
          <Text className="text-sm">{p.description}</Text>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-navy-700 hover:underline">
              Visit site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }

    case "timeline": {
      const p = payload as unknown as TimelinePayload;
      return (
        <ol className="space-y-4 border-l border-neutral-200 pl-5">
          {p.events.map((event, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-navy-800" aria-hidden="true" />
              <Muted className="font-mono text-xs">{event.date}</Muted>
              <p className="font-medium text-foreground">{event.title}</p>
              {event.description && <Text className="text-sm text-muted-foreground">{event.description}</Text>}
            </li>
          ))}
        </ol>
      );
    }

    case "quote": {
      const p = payload as unknown as QuotePayload;
      return (
        <blockquote className="border-l-4 border-navy-300 py-1 pl-5">
          <p className="font-voice text-xl italic leading-relaxed text-foreground">&ldquo;{p.text}&rdquo;</p>
          {p.attribution && <footer className="mt-2 text-sm text-muted-foreground">— {p.attribution}</footer>}
        </blockquote>
      );
    }

    case "reflection": {
      const p = payload as unknown as ReflectionPayload;
      return (
        <div className="space-y-1 rounded-lg bg-surface-2 p-5">
          <Eyebrow>Reflection</Eyebrow>
          <p className="font-voice text-lg text-foreground">{p.question || "What question should the reader consider?"}</p>
          {p.promptHelp && <Muted>{p.promptHelp}</Muted>}
        </div>
      );
    }

    case "todays_wisdom": {
      const p = payload as unknown as TodaysWisdomPayload;
      return (
        <div className="space-y-2 rounded-sm border-l-4 border-gold-600 bg-gold-50 p-5">
          <Eyebrow>Today&apos;s Wisdom</Eyebrow>
          {p.sourceText && <p className="font-voice text-base text-foreground">{p.sourceText}</p>}
          {p.iast && <p className="font-voice italic text-muted-foreground">{p.iast}</p>}
          <p className="font-voice text-lg italic text-foreground">&ldquo;{p.translation || "Translation goes here."}&rdquo;</p>
          {(p.context || p.source) && (
            <Muted className="text-xs">
              {p.source}
              {p.source && p.context && " — "}
              {p.context}
            </Muted>
          )}
        </div>
      );
    }

    case "action_checklist": {
      const p = payload as unknown as ActionChecklistPayload;
      return (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-card p-5">
          <Eyebrow>Action Checklist</Eyebrow>
          <ul className="space-y-2">
            {p.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                {item.done ? (
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    default:
      return (
        <div className="rounded-md border border-dashed border-neutral-300 p-4 text-sm text-muted-foreground">
          Unsupported block type: <code className="font-mono">{type}</code>
        </div>
      );
  }
}

function EmptyBlockPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-surface-2 p-6 text-center text-sm text-muted-foreground">
      {label} — click to edit
    </div>
  );
}
