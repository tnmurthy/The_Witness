"use client";

interface Block {
  type: string;
  payload: Record<string, unknown>;
}

function s(v: unknown): string {
  return String(v ?? "");
}

export function PublicBlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <BlockNode key={i} block={block} />
      ))}
    </div>
  );
}

function BlockNode({ block }: { block: Block }) {
  const p = block.payload;
  switch (block.type) {
    case "heading": {
      const level = Number(p.level ?? 2);
      const text = s(p.text);
      if (level === 1)
        return <h1 className="mb-4 mt-10 font-serif text-3xl font-bold text-neutral-900">{text}</h1>;
      if (level === 2)
        return <h2 className="mb-3 mt-8 font-serif text-2xl font-bold text-neutral-900">{text}</h2>;
      return <h3 className="mb-2 mt-6 font-serif text-xl font-semibold text-neutral-900">{text}</h3>;
    }
    case "paragraph":
      return <p className="text-lg leading-relaxed text-neutral-800">{s(p.text)}</p>;
    case "hero_story":
      return (
        <div className="my-8 border-l-4 border-navy-700 py-2 pl-5">
          {!!p.headline && <p className="mb-2 font-serif text-xl font-bold text-navy-900">{s(p.headline)}</p>}
          {!!p.body && <p className="text-lg leading-relaxed text-neutral-700">{s(p.body)}</p>}
        </div>
      );
    case "signal_card":
      return (
        <div className="my-6 rounded-lg border border-neutral-200 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Technology Signal
          </p>
          {!!p.signal && <p className="mb-2 font-serif text-xl font-bold text-neutral-900">{s(p.signal)}</p>}
          {!!p.explanation && <p className="leading-relaxed text-neutral-700">{s(p.explanation)}</p>}
          {!!p.impact && (
            <p className="mt-3 text-sm text-neutral-500">
              <strong>Impact:</strong> {s(p.impact)}
            </p>
          )}
        </div>
      );
    case "career_insight":
      return (
        <div className="my-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-700">
            Career Insight
          </p>
          {!!p.insight && <p className="mb-2 leading-relaxed text-neutral-800">{s(p.insight)}</p>}
          {!!p.action && (
            <p className="text-sm text-neutral-600">
              <strong>Action:</strong> {s(p.action)}
            </p>
          )}
        </div>
      );
    case "pullquote":
      return (
        <blockquote className="my-8 border-l-2 border-neutral-300 pl-6">
          <p className="font-serif text-2xl italic leading-relaxed text-neutral-700">{s(p.quote)}</p>
          {!!p.attribution && (
            <cite className="mt-3 block text-sm not-italic text-neutral-400">— {s(p.attribution)}</cite>
          )}
        </blockquote>
      );
    case "divider":
      return <hr className="my-8 border-neutral-200" />;
    case "callout":
      return (
        <div className="my-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          {!!p.label && <p className="mb-1 text-xs font-semibold text-blue-700">{s(p.label)}</p>}
          <p className="text-neutral-800">{s(p.text)}</p>
        </div>
      );
    case "technology_radar": {
      const item = s(p.name ?? p.title);
      const stage = s(p.stage ?? p.ring);
      const desc = s(p.description ?? p.rationale);
      return item ? (
        <div className="my-4 rounded border-l-4 border-purple-400 bg-purple-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
            Technology Radar
          </p>
          <p className="font-medium text-neutral-900">
            {item}
            {stage ? ` — ${stage}` : ""}
          </p>
          {!!desc && <p className="mt-1 text-sm text-neutral-600">{desc}</p>}
        </div>
      ) : null;
    }
    case "book_recommendation": {
      const title = s(p.title ?? p.bookTitle);
      const author = s(p.author);
      const takeaway = s(p.takeaway ?? p.keyInsight);
      return title ? (
        <div className="my-4 rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Book Recommendation
          </p>
          <p className="font-medium text-neutral-900">
            {title}
            {author ? ` by ${author}` : ""}
          </p>
          {!!takeaway && <p className="mt-1 text-sm text-neutral-600">{takeaway}</p>}
        </div>
      ) : null;
    }
    case "chart": {
      const chartTitle = s(p.title ?? p.chartTitle);
      const summary = s(p.summary ?? p.description);
      return (
        <div className="my-4 rounded border border-dashed border-neutral-300 px-4 py-3 text-center">
          <p className="text-xs text-neutral-400">
            📊 {chartTitle || "Chart"}
            {summary ? ` — ${summary}` : " (view online for interactive chart)"}
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}
