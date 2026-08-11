import { PortalShell } from "@/components/portal/portal-shell";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
