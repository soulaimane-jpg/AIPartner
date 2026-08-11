import { PortalShell } from "@/components/portal/portal-shell";

export default function GooglerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell allow={["GOOGLER", "ADMIN"]} signInRedirect="/auth/sign-in?next=/google">
      <div className="page-container py-8 lg:py-10">
        {children}
      </div>
    </PortalShell>
  );
}
