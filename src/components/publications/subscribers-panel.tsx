"use client";
/**
 * SubscribersPanel — displays subscriber count, recent subscribers,
 * and 30-day delivery stats. Shown in the publication settings Subscribers tab.
 * EiC top complaint: no visibility into subscriber count or delivery health.
 */
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriberData {
  total: number;
  unsubscribed: number;
  subscribers: Array<{ id: string; email: string; subscribedAt: string }>;
  delivery30d: { sent: number; failed: number; rate: number | null };
}

export function SubscribersPanel({ publicationId }: { publicationId: string }) {
  const [data, setData] = React.useState<SubscriberData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/publications/${publicationId}/subscribers`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load subscriber data");
        setLoading(false);
      });
  }, [publicationId]);

  if (loading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active subscribers" value={data.total} color="green" />
        <StatCard label="Unsubscribed" value={data.unsubscribed} color="neutral" />
        <StatCard
          label="Delivery rate (30d)"
          value={data.delivery30d.rate !== null ? `${data.delivery30d.rate}%` : "—"}
          color={data.delivery30d.rate !== null && data.delivery30d.rate >= 95 ? "green" : "amber"}
          sub={
            data.delivery30d.sent > 0
              ? `${data.delivery30d.sent} sent, ${data.delivery30d.failed} failed`
              : "No emails sent yet"
          }
        />
      </div>

      {/* Subscriber list */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">
          Recent subscribers {data.total > 50 ? `(showing 50 of ${data.total})` : ""}
        </h3>
        {data.subscribers.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            No subscribers yet. Share your publication URL to get started.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {data.subscribers.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-neutral-800">{s.email}</span>
                <span className="text-xs text-neutral-400">
                  {new Date(s.subscribedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color: "green" | "amber" | "neutral";
  sub?: string;
}) {
  const colors = {
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    neutral: "text-neutral-700 bg-neutral-50",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color]}`}>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}
