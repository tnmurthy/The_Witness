/**
 * src/lib/email/render-issue.ts
 *
 * Converts an issue's block tree into a plain-HTML email body.
 * Deliberately simple: no external templating engine, no React email
 * renderer — just well-structured HTML that works across email clients.
 *
 * Design decisions:
 * - Inline styles only (no <style> blocks — Gmail strips them)
 * - Max width 600px (universal email safe width)
 * - One font stack with web-safe fallbacks
 * - Block types that have no email-appropriate rendering (chart,
 *   technology_radar, etc.) are skipped with a placeholder comment
 */
import "server-only";

interface Block {
  type: string;
  payload: Record<string, unknown>;
  ai_generated: boolean;
}

interface Publication {
  name: string;
  slug: string;
  description?: string | null;
}

interface Issue {
  title: string;
  slug: string;
}

const FONT = "font-family: Georgia, 'Times New Roman', serif;";
const SANS = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;";
const MAX_W = "max-width: 600px; margin: 0 auto;";
const BODY_COLOR = "#1a1a1a";
const MUTED = "#6b7280";

function renderBlock(block: Block): string {
  const p = block.payload;

  switch (block.type) {
    case "heading": {
      const text = String(p.text ?? "");
      const level = Number(p.level ?? 2);
      const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px" };
      const size = sizes[level] ?? "20px";
      return `<h${level} style="${FONT} font-size:${size}; font-weight:700; color:${BODY_COLOR}; margin:28px 0 12px;">${escHtml(text)}</h${level}>`;
    }

    case "paragraph": {
      const text = String(p.text ?? "");
      if (!text.trim()) return "";
      return `<p style="${FONT} font-size:17px; line-height:1.7; color:${BODY_COLOR}; margin:0 0 18px;">${escHtml(text)}</p>`;
    }

    case "hero_story": {
      const headline = String(p.headline ?? "");
      const body = String(p.body ?? "");
      return `
<div style="border-left:4px solid #1e3a5f; padding:16px 20px; margin:24px 0; background:#f8fafc;">
  ${headline ? `<p style="${FONT} font-size:20px; font-weight:700; color:#1e3a5f; margin:0 0 8px;">${escHtml(headline)}</p>` : ""}
  ${body ? `<p style="${FONT} font-size:16px; line-height:1.65; color:${BODY_COLOR}; margin:0;">${escHtml(body)}</p>` : ""}
</div>`;
    }

    case "signal_card": {
      const signal = String(p.signal ?? "");
      const explanation = String(p.explanation ?? "");
      const impact = String(p.impact ?? "");
      return `
<div style="border:1px solid #e5e7eb; border-radius:6px; padding:20px; margin:20px 0;">
  <p style="${SANS} font-size:11px; font-weight:600; letter-spacing:0.08em; color:#6366f1; text-transform:uppercase; margin:0 0 8px;">Technology Signal</p>
  ${signal ? `<p style="${FONT} font-size:18px; font-weight:700; color:${BODY_COLOR}; margin:0 0 10px;">${escHtml(signal)}</p>` : ""}
  ${explanation ? `<p style="${FONT} font-size:15px; line-height:1.6; color:${BODY_COLOR}; margin:0 0 10px;">${escHtml(explanation)}</p>` : ""}
  ${impact ? `<p style="${SANS} font-size:13px; color:${MUTED}; margin:0;"><strong>Impact:</strong> ${escHtml(impact)}</p>` : ""}
</div>`;
    }

    case "career_insight": {
      const insight = String(p.insight ?? "");
      const action = String(p.action ?? "");
      return `
<div style="background:#fffbeb; border-left:4px solid #d97706; padding:16px 20px; margin:20px 0;">
  <p style="${SANS} font-size:11px; font-weight:600; letter-spacing:0.08em; color:#d97706; text-transform:uppercase; margin:0 0 8px;">Career Insight</p>
  ${insight ? `<p style="${FONT} font-size:16px; line-height:1.65; color:${BODY_COLOR}; margin:0 0 8px;">${escHtml(insight)}</p>` : ""}
  ${action ? `<p style="${SANS} font-size:13px; color:${MUTED}; margin:0;"><strong>Action:</strong> ${escHtml(action)}</p>` : ""}
</div>`;
    }

    case "pullquote": {
      const quote = String(p.quote ?? "");
      const attribution = String(p.attribution ?? "");
      return `
<blockquote style="margin:24px 0; padding:4px 24px; border-left:3px solid #d1d5db;">
  <p style="${FONT} font-size:20px; font-style:italic; line-height:1.5; color:${BODY_COLOR}; margin:0 0 8px;">${escHtml(quote)}</p>
  ${attribution ? `<cite style="${SANS} font-size:13px; color:${MUTED}; font-style:normal;">— ${escHtml(attribution)}</cite>` : ""}
</blockquote>`;
    }

    case "divider":
      return `<hr style="border:none; border-top:1px solid #e5e7eb; margin:32px 0;" />`;

    case "callout": {
      const text = String(p.text ?? "");
      const label = String(p.label ?? "Note");
      return `
<div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:16px 20px; margin:20px 0;">
  <p style="${SANS} font-size:12px; font-weight:600; color:#0284c7; margin:0 0 6px;">${escHtml(label)}</p>
  <p style="${FONT} font-size:15px; line-height:1.6; color:${BODY_COLOR}; margin:0;">${escHtml(text)}</p>
</div>`;
    }

    default:
      // Block types with no email representation (chart, technology_radar,
      // book_recommendation, etc.) are silently skipped — they don't translate
      // to email and excluding them is better than rendering broken content.
      return `<!-- block type '${block.type}' not rendered in email -->`;
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface RenderIssueEmailOptions {
  issue: Issue;
  publication: Publication;
  blocks: Block[];
  unsubscribeUrl: string;
  webUrl: string;
}

export function renderIssueEmail({
  issue,
  publication,
  blocks,
  unsubscribeUrl,
  webUrl,
}: RenderIssueEmailOptions): { html: string; text: string } {
  const bodyBlocks = blocks.map(renderBlock).filter(Boolean).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(issue.title)}</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:32px 16px;">
    <tr>
      <td>
        <div style="${MAX_W}">

          <!-- Header -->
          <div style="text-align:center; padding-bottom:24px; border-bottom:1px solid #e5e7eb; margin-bottom:32px;">
            <p style="${SANS} font-size:13px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#6366f1; margin:0 0 6px;">${escHtml(publication.name)}</p>
            <h1 style="${FONT} font-size:32px; font-weight:700; color:#111827; margin:0 0 12px; line-height:1.2;">${escHtml(issue.title)}</h1>
            <a href="${webUrl}" style="${SANS} font-size:13px; color:#6b7280; text-decoration:none;">Read online →</a>
          </div>

          <!-- Body -->
          <div style="background:#ffffff; border-radius:8px; padding:32px; margin-bottom:24px;">
            ${bodyBlocks}
          </div>

          <!-- Footer -->
          <div style="text-align:center; padding-top:16px;">
            <p style="${SANS} font-size:12px; color:#9ca3af; margin:0 0 6px;">
              You're receiving this because you subscribed to ${escHtml(publication.name)}.
            </p>
            <p style="${SANS} font-size:12px; color:#9ca3af; margin:0;">
              <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a>
            </p>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text fallback
  const text = blocks
    .map((b) => {
      const p = b.payload;
      switch (b.type) {
        case "heading":
          return `\n${String(p.text ?? "").toUpperCase()}\n${"─".repeat(40)}\n`;
        case "paragraph":
          return String(p.text ?? "");
        case "hero_story":
          return `${String(p.headline ?? "")}\n\n${String(p.body ?? "")}`;
        case "signal_card":
          return `SIGNAL: ${String(p.signal ?? "")}\n${String(p.explanation ?? "")}`;
        case "career_insight":
          return `CAREER INSIGHT: ${String(p.insight ?? "")}\nAction: ${String(p.action ?? "")}`;
        case "pullquote":
          return `"${String(p.quote ?? "")}" — ${String(p.attribution ?? "")}`;
        case "callout":
          return `[${String(p.label ?? "Note")}] ${String(p.text ?? "")}`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n")
    .concat(`\n\n---\nRead online: ${webUrl}\nUnsubscribe: ${unsubscribeUrl}`);

  return { html, text };
}
