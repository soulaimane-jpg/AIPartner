export default function PartnerPortalLoading() {
  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10" aria-busy="true" aria-label="Loading partner workspace">
      <div className="space-y-3 border-b border-line pb-6">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-9 w-full max-w-md" />
        <div className="skeleton h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-line bg-card p-6 shadow-elev-1">
            <div className="skeleton h-10 w-10" />
            <div className="skeleton mt-5 h-7 w-16" />
            <div className="skeleton mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-line bg-card p-6 shadow-elev-1">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="skeleton h-4 w-28" />
                <div className="skeleton mt-4 h-6 w-full max-w-lg" />
                <div className="skeleton mt-3 h-3 w-full max-w-2xl" />
              </div>
              <div className="skeleton hidden h-10 w-32 sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
