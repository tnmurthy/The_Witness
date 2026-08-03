"use client";
import { RouteErrorFallback } from "@/components/error/error-boundary";

export default function OrgDetailErrorError({ error }: { error: Error }) {
  return <RouteErrorFallback error={error} />;
}
