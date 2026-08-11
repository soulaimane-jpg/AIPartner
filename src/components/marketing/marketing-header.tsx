"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string }[] = [
  { href: "/#benefits", label: "Why partners" },
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/#process", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/pricing", label: "Pricing" },
  { href: "/partner/register", label: "For partners" },
];

export interface MarketingHeaderProps {
  signedIn?: boolean;
  /** Role of the signed-in user — decides where the primary CTA points. */
  role?: string | null;
  /** Reserved — left for backward compat with the previous floating-glass API. */
  cinema?: boolean;
}

/**
 * Where a signed-in user's primary CTA should land, per role. Each role
 * has its own portal home; sending everyone to `/dashboard` (customer-only)
 * gets non-customers bounced back to `/` by the middleware role gate.
 */
function portalHomeForRole(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PARTNER":
      return "/partner";
    case "GOOGLER":
      return "/google";
    case "COLLABORATOR":
      return "/collaborations";
    case "CUSTOMER":
    default:
      return "/dashboard";
  }
}

/**
 * Solid-dark single-tier marketing header (Salsify-aligned).
 *
 *   - Pure cinema-bg background, no transparency, no scroll-driven blur.
 *   - Brand lockup (inverse / cream) at left.
 *   - 5-item uppercase nav centered right.
 *   - Right cluster: small "Sign in" link + a magenta-gradient pill CTA.
 *   - Mobile collapses to a hamburger that opens an inline dark panel.
 */
export function MarketingHeader({ signedIn = false, role = null }: MarketingHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Signed-in users land on their role's portal home. Pointing everyone at
  // `/dashboard` (customer/admin-only) makes the middleware role gate bounce
  // partners / Googlers / collaborators straight back to `/`.
  const ctaHref = signedIn ? portalHomeForRole(role) : "/auth/sign-up";

  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled || open}
      className="marketing-header sticky top-0 z-50 border-b"
    >
      <div className="container-app flex items-center gap-6 transition-[height] duration-300 ease-out-quart data-[scrolled=true]:h-14 h-[4.5rem]">
        {/* Brand */}
        <BrandLockup size="sm" inverse />

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7 ml-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative inline-flex items-center text-[12.5px] font-semibold uppercase tracking-[0.06em]",
                "text-[hsl(36_30%_88%)] hover:text-white",
                "transition-colors duration-160 ease-out-quart",
                "after:absolute after:left-0 after:right-0 after:-bottom-[20px] after:h-[2px] after:bg-magenta-1",
                "after:origin-left after:scale-x-0 hover:after:scale-x-100",
                "after:transition-transform after:duration-240 after:ease-out-quart",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right cluster (desktop) */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            href={signedIn ? "/account" : "/auth/sign-in"}
            className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[hsl(36_30%_88%)] hover:text-white transition-colors duration-160"
          >
            {signedIn ? "My account" : "Sign in"}
          </Link>
          <Button asChild variant="pill-magenta" size="md" className="px-6">
            <Link href={ctaHref}>Find Your Partner</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="md:hidden grid h-9 w-9 place-items-center rounded-md text-[hsl(36_30%_92%)] hover:bg-white/10 transition-colors duration-160"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-cinema-bg border-t border-[hsl(268_25%_16%)] px-4 pb-4">
          <div className="flex flex-col gap-1 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[hsl(36_30%_88%)] hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-[hsl(268_25%_16%)]">
            <Button asChild variant="pill-outline-light" size="sm" className="flex-1 px-5">
              <Link href={signedIn ? "/account" : "/auth/sign-in"} onClick={() => setOpen(false)}>{signedIn ? "My account" : "Sign in"}</Link>
            </Button>
            <Button asChild variant="pill-magenta" size="sm" className="flex-1 px-5">
              <Link href={ctaHref} onClick={() => setOpen(false)}>Find Your Partner</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
