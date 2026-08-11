import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { CookiePreferencesLink } from "@/components/marketing/cookie-preferences-link";

const LINKS = [
  { label: "How it works", href: "/#process" },
  { label: "Capabilities", href: "/#capabilities" },
  { label: "Pricing", href: "/pricing" },
  { label: "For partners", href: "/partner/register" },
  { label: "Privacy", href: "/#privacy" },
  { label: "Trust centre", href: "/trust" },
];

/**
 * Small single-row footer (Salsify-aligned, intentionally compact).
 *
 * Cream background, hairline top border, ~64px tall. No social row,
 * no megafooter columns, no marketing copy.
 */
export function MarketingFooter() {
  return (
    <footer className="bg-surface-2 border-t border-line">
      <div className="container-app py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <BrandLockup size="sm" />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:ml-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors duration-160"
            >
              {l.label}
            </Link>
          ))}
          {/* Not a <Link>: reopens the consent banner in place. */}
          <CookiePreferencesLink className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors duration-160" />
        </nav>
        <div className="flex-1" />
        <p className="text-[12px] text-muted-foreground/85">
          © {new Date().getFullYear()} AI Partner. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
