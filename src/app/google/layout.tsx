import { PortalShell } from "@/components/portal/portal-shell";

export default function GooglerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell allow={["GOOGLER", "ADMIN"]} signInRedirect="/auth/sign-in?next=/google">
      {children}
    </PortalShell>
  );
}
