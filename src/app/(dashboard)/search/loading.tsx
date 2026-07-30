import { Skeleton } from "@/components/ui/skeleton";
export default function SearchLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-full max-w-xl" />
    </div>
  );
}
