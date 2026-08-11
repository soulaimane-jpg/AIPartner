import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="page-container portal-page py-6 sm:py-8 lg:py-10" role="status" aria-label="Loading page">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
