"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Send } from "lucide-react";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Muted } from "@/components/ui/typography";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success",
  in_review: "warning",
  rejected: "danger",
  draft: "neutral",
};

interface WisdomReviewActionsProps {
  entryId: string;
  reviewStatus: string;
  isAuthor: boolean;
  canReview: boolean;
  reviewNotes?: string | null;
}

export function WisdomReviewActions({
  entryId,
  reviewStatus,
  isAuthor,
  canReview,
  reviewNotes,
}: WisdomReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: "submit-review" | "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/wisdom-entries/${entryId}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      toast.success("Updated");
      router.refresh();
    } catch (error) {
      logger.error("Wisdom review action failed in UI", { error, entryId, action });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-card p-4">
      <Badge variant={STATUS_VARIANT[reviewStatus] ?? "neutral"} className="capitalize">
        {reviewStatus.replace("_", " ")}
      </Badge>

      {reviewStatus === "rejected" && reviewNotes && <Muted className="text-sm">Reason: {reviewNotes}</Muted>}

      <div className="ml-auto flex gap-2">
        {isAuthor && reviewStatus === "draft" && (
          <Button size="sm" disabled={loading === "submit-review"} onClick={() => act("submit-review")}>
            <Send className="h-3.5 w-3.5" /> Submit for review
          </Button>
        )}
        {canReview && reviewStatus === "in_review" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-danger-700"
              disabled={loading === "reject"}
              onClick={() => act("reject")}
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button size="sm" disabled={loading === "approve"} onClick={() => act("approve")}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
