"use client";
import { RouteErrorFallback } from "@/components/error/error-boundary";

export default function WisdomErrorError({ error }: { error: Error }) {
  return <RouteErrorFallback error={error} />;
}
