/**
 * src/components/issue-builder/publish-button.tsx
 *
 * The publish/submit-for-review button that appears in the Issue Builder
 * toolbar. Renders differently based on the user's role and the issue's
 * current status — the most important missing UI element in the platform.
 *
 * State machine:
 *   Writer, draft        → "Submit for review"  (POST /submit-review)
 *   Writer, in_review    → disabled "In review"
 *   Editor, draft        → "Publish"             (POST /publish)
 *   Editor, in_review    → "Publish" + "Request changes" (DELETE /publish)
 *   Editor, published    → disabled "Published"
 *   Editor, scheduled    → disabled "Scheduled"
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, CheckCircle, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { logger } from "@/lib/logger";

interface PublishButtonProps {
  issueId: string;
  publicationId: string;
  issueTitle: string;
  currentStatus: string;
  /** membership role within this publication */
  membershipRole: "editor_in_chief" | "editor" | "writer" | "researcher" | null;
  platformRole: string;
}

export function PublishButton({
  issueId,
  // publicationId passed for future use (e.g. publication-scoped rate limits)
  issueTitle,
  currentStatus,
  membershipRole,
  platformRole,
}: PublishButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);

  const isEditor =
    platformRole === "super_admin" || membershipRole === "editor_in_chief" || membershipRole === "editor";
  const isWriter = membershipRole === "writer" || membershipRole === "researcher";

  async function submitForReview() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/submit-review`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json();
        toast.error(b.error ?? "Failed to submit for review");
        return;
      }
      toast.success("Issue submitted for editorial review");
      router.refresh();
    } catch (err) {
      logger.error("Submit for review failed", { error: err, issueId });
      toast.error("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function publishNow() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const b = await res.json();
      if (!res.ok) {
        toast.error(b.error ?? "Failed to publish");
        return;
      }
      const d = b.delivery;
      if (d?.sent > 0) {
        toast.success(`Published — ${d.sent} email${d.sent !== 1 ? "s" : ""} sent`);
      } else if (d?.total === 0) {
        toast.success("Published — no subscribers yet");
      } else {
        toast.success("Published");
      }
      setPublishOpen(false);
      router.refresh();
    } catch (err) {
      logger.error("Publish failed", { error: err, issueId });
      toast.error("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function requestChanges() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/publish`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json();
        toast.error(b.error ?? "Failed to request changes");
        return;
      }
      toast.success("Returned to writer for changes");
      router.refresh();
    } catch (err) {
      logger.error("Request changes failed", { error: err, issueId });
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Render: already published/scheduled ──────────────────────────────────
  if (currentStatus === "published") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 text-green-700">
        <CheckCircle className="h-3.5 w-3.5" />
        Published
      </Button>
    );
  }
  if (currentStatus === "scheduled") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Scheduled
      </Button>
    );
  }
  if (currentStatus === "archived") return null;

  // ── Render: writer flow ───────────────────────────────────────────────────
  if (isWriter && !isEditor) {
    if (currentStatus === "in_review") {
      return (
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          In review
        </Button>
      );
    }
    return (
      <Button size="sm" variant="outline" onClick={submitForReview} disabled={loading} className="gap-1.5">
        <Send className="h-3.5 w-3.5" />
        {loading ? "Submitting…" : "Submit for review"}
      </Button>
    );
  }

  // ── Render: editor flow ───────────────────────────────────────────────────
  if (!isEditor) return null;

  return (
    <div className="flex items-center gap-2">
      {currentStatus === "in_review" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={requestChanges}
          disabled={loading}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Request changes
        </Button>
      )}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="signal" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Publish
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish &ldquo;{issueTitle}&rdquo;?</DialogTitle>
            <DialogDescription>
              This will mark the issue as published and email it to all active subscribers. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="signal" onClick={publishNow} disabled={loading}>
              {loading ? "Publishing…" : "Publish now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
