import { Skeleton } from "@/components/ui/skeleton";
export default function ArticleBuilderLoading() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-3">
        <Skeleton className="h-6 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex flex-1 gap-4">
        <div className="flex-1 space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="w-72 rounded-lg" />
      </div>
    </div>
  );
}
