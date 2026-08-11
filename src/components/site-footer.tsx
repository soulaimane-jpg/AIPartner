import Link from "next/link";
import { Logo } from "@/components/brand";
import { BRAND } from "@/lib/constants";

const COLS: { heading: string; items: { label: string; href?: string }[] }[] = [
  {
    heading: "Platform",
    items: [
      { label: "Pricing", href: "/pricing" },
      { label: "Get started", href: "/auth/sign-up" },
      { label: "Partner portal", href: "/auth/sign-in" },
    ],
  },
  {
    heading: "Company",
    items: [{ label: "About" }, { label: "Customers" }, { label: "Contact" }],
  },
  {
    heading: "Legal",
    items: [
      { label: "Privacy" },
      { label: "Terms" },
      { label: "Status" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[hsl(220_14%_98%)]">
      <div className="page-container grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1 space-y-4">
          <Logo showBadge={false} size="sm" />
          <p className="text-[13px] leading-relaxed text-muted-foreground max-w-xs">
            The sourcing workspace for Google Cloud buyers and partners.
          </p>
        </div>

        {COLS.map(({ heading, items }) => (
          <div key={heading}>
            <h4 className="section-label mb-4">{heading}</h4>
            <ul className="space-y-2.5 text-[13.5px] text-muted-foreground">
              {items.map((it) =>
                it.href ? (
                  <li key={it.label}>
                    <Link
                      href={it.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {it.label}
                    </Link>
                  </li>
                ) : (
                  <li key={it.label} className="opacity-60">
                    {it.label}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="page-container flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-5 text-[12px] text-muted-foreground">
          <span>{BRAND.copyright}</span>
          <span>Google Cloud verified network</span>
        </div>
      </div>
    </footer>
  );
}
