"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubscribeForm({
  publicationId,
  publicationName,
}: {
  publicationId: string;
  publicationName: string;
}) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/publications/${publicationId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const b = await res.json();
      if (!res.ok) {
        toast.error(b.error ?? "Failed to subscribe");
        return;
      }
      setDone(true);
      toast.success(`You're subscribed to ${publicationName}`);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-4 text-center">
        <p className="text-sm font-medium text-green-800">
          You&apos;re subscribed! Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-sm gap-2">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1"
        aria-label="Email address"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Subscribe"}
      </Button>
    </form>
  );
}
