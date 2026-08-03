/**
 * src/__tests__/accessibility/components.test.tsx
 *
 * Automated WCAG 2.1 AA accessibility checks using jest-axe.
 * Catches the most common a11y violations at the component level:
 *   - Missing alt text
 *   - Insufficient colour contrast (when inline styles are used)
 *   - Missing form labels
 *   - Incorrect ARIA usage
 *   - Non-descriptive button text
 *
 * These are not a replacement for manual screen reader testing or
 * Lighthouse audits — they catch what can be caught automatically
 * (~30% of WCAG criteria). Manual testing remains required.
 *
 * WCAG 2.1 AA is the explicit product accessibility target (F-012).
 */
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { expect, describe, it } from "vitest";
import { SubscribeForm } from "@/components/public/subscribe-form";
import { PublicBlockRenderer } from "@/components/public/public-block-renderer";

expect.extend(toHaveNoViolations);

describe("Accessibility — WCAG 2.1 AA (automated checks)", () => {
  describe("SubscribeForm", () => {
    it("has no automatically detectable WCAG violations", async () => {
      const { container } = render(
        <SubscribeForm publicationId="pub-1" publicationName="Test Publication" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("email input has an accessible label", () => {
      const { getByRole } = render(
        <SubscribeForm publicationId="pub-1" publicationName="Test Publication" />
      );
      const input = getByRole("textbox", { name: /email/i });
      expect(input).toBeDefined();
    });

    it("submit button has accessible text", () => {
      const { getByRole } = render(
        <SubscribeForm publicationId="pub-1" publicationName="Test Publication" />
      );
      const button = getByRole("button");
      expect(button.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  describe("PublicBlockRenderer", () => {
    it("renders paragraph blocks without WCAG violations", async () => {
      const blocks = [
        { type: "paragraph", payload: { text: "This is a test paragraph." } },
        { type: "heading", payload: { text: "A Section Heading", level: 2 } },
        {
          type: "pullquote",
          payload: { quote: "Wisdom is knowing what you don't know.", attribution: "Socrates" },
        },
      ];
      const { container } = render(<PublicBlockRenderer blocks={blocks} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("renders callout blocks without WCAG violations", async () => {
      const blocks = [
        { type: "callout", payload: { label: "Important", text: "Please read this carefully." } },
        {
          type: "signal_card",
          payload: { signal: "Rising Signal", explanation: "This matters.", impact: "High" },
        },
      ];
      const { container } = render(<PublicBlockRenderer blocks={blocks} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("renders empty block list without violations", async () => {
      const { container } = render(<PublicBlockRenderer blocks={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
