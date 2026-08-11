import { PortalShell } from "@/components/portal/portal-shell";

/**
 * `/collaborations` is reachable by both COLLABORATOR-only accounts (their
 * landing page) and full CUSTOMERs (read-only cross-tenant inventory) —
 * and ADMINs for support. The shared `PortalShell` provides the chrome
 * so the surface matches the rest of the product.
 */
export default function CollaborationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell allow={["COLLABORATOR", "CUSTOMER", "ADMIN"]}>
      <div className="page-container portal-page py-6 sm:py-8 lg:py-10">
        {children}
      </div>
    </PortalShell>
  );
}
