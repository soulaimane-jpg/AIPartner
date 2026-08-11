import { PortalShell } from "@/components/portal/portal-shell";

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell allow={["CUSTOMER", "ADMIN"]}>
      {children}
    </PortalShell>
  );
}
