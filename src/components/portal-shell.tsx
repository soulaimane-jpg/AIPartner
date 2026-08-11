import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

// Shared chrome for every portal page.
//
// A page renders:
//
//   <PortalShell
//     title="Projects"
//     description="Scope cloud work…"
//     breadcrumbs={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}
//     actions={<Button>New brief</Button>}
//   >
//     ...page body...
//   </PortalShell>
//
// The shell standardises:
//   - container width + vertical rhythm
//   - optional breadcrumb row
//   - the page header (title + description + right-aligned action slot)
//   - a server-rendered card-rise entrance for the body content (no JS needed)
//
// It's intentionally a *page-level* helper rather than a route-level layout
// so callers can opt in screen-by-screen without forcing every existing
// page to refactor at once.
export function PortalShell({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  children,
  size = "default",
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tiny uppercase label above the title — e.g. "Customer · Brief 2451". */
  eyebrow?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  size?: "default" | "wide" | "narrow";
  className?: string;
  bodyClassName?: string;
}) {
  const containerClass =
    size === "wide"
      ? "page-container-wide"
      : size === "narrow"
        ? "mx-auto w-full max-w-[920px] px-6 lg:px-8"
        : "page-container";

  return (
    <div className={cn(containerClass, "py-8 lg:py-10 space-y-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="section-label mb-2.5">{eyebrow}</div>
          )}
          <h1 className="text-balance">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      <div className={cn("space-y-6 animate-card-rise", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {items.map((crumb, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
            {crumb.href && !last ? (
              <Link
                href={crumb.href}
                className="rounded px-1 -mx-1 hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={cn(last && "text-foreground font-medium")}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
