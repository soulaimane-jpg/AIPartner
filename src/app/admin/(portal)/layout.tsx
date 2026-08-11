import { PortalShell } from "@/components/portal/portal-shell";

/**
 * Admin uses the same `PortalShell` chrome as Customer / Partner / Googler
 * — slim left rail, top bar, ⌘K palette, fade route transitions. Role-
 * specific nav items live in `getPortalNav("ADMIN")` and the page-level
 * sub-navigation (Partner ops, Flags, Developers, etc.) is reached via
 * the command palette + breadcrumbs inside individual admin pages.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell allow={["ADMIN"]} signInRedirect="/admin/login">
      <div className="page-container py-8 lg:py-10">
        {children}
      </div>
    </PortalShell>
  );
}
