import { redirect } from "next/navigation";
import {
  Shield,
  Smartphone,
  MonitorSmartphone,
  ScrollText,
  Fingerprint,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { DsrRequestRow } from "@/lib/db/rows";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/icon-tile";
import { getCurrentUserSecurityState } from "@/lib/actions/auth-mfa";
import { listPasskeysForUser } from "@/lib/passkeys";
import { MfaSection } from "./_components/mfa-section";
import { SessionList } from "./_components/session-list";
import { DsrPanel } from "./_components/dsr-panel";
import { PasskeySection } from "./_components/passkey-section";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/account/security");

  const [{ mfa, sessions, user }, dsrRows, passkeys] = await Promise.all([
    getCurrentUserSecurityState(session.user.id),
    query<DsrRequestRow>(
      'SELECT * FROM "DsrRequest" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 10',
      [session.user.id],
    ),
    listPasskeysForUser(session.user.id),
  ]);

  return (
    <div className="page-container portal-page max-w-5xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <Shield className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow">Account</div>
            <h1 className="portal-page-title">Security</h1>
            <p className="portal-page-description">
              {user?.email} · {user?.role}
            </p>
          </div>
        </div>
      </header>

      <Card className="customer-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-start gap-3">
            <IconTile size="sm" tone="muted"><Smartphone /></IconTile>
            <div>
              <h2 className="font-semibold">Two-factor authentication</h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Add a one-time-passcode app (1Password, Authy, Google
                Authenticator…) for sign-in and sensitive actions like
                deleting your tenant or rotating API keys.
              </p>
            </div>
          </div>
          <Badge variant={mfa.enabled ? "default" : "secondary"}>
            {mfa.enabled ? "Enabled" : "Off"}
          </Badge>
        </div>
        <MfaSection
          enrolled={mfa.enrolled}
          enabled={mfa.enabled}
          remainingRecoveryCodes={mfa.remainingRecoveryCodes}
        />
      </Card>

      <Card className="customer-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-start gap-3">
            <IconTile size="sm" tone="muted"><Fingerprint /></IconTile>
            <div>
              <h2 className="font-semibold">Passkeys</h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Stronger and faster than passwords + TOTP. Use Touch ID,
                Windows Hello, or a hardware security key. Phishing-proof
                by design.
              </p>
            </div>
          </div>
          <Badge variant={passkeys.length > 0 ? "default" : "secondary"}>
            {passkeys.length}
          </Badge>
        </div>
        <PasskeySection initial={passkeys} />
      </Card>

      <Card className="customer-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-start gap-3">
            <IconTile size="sm" tone="muted"><MonitorSmartphone /></IconTile>
            <div>
              <h2 className="font-semibold">Active sessions</h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Devices currently signed into your account. Revoke any
                you don&apos;t recognise — the device will need to sign
                in again next time it&apos;s used.
              </p>
            </div>
          </div>
          <Badge variant="outline">{sessions.length}</Badge>
        </div>
        <SessionList sessions={sessions} />
      </Card>

      <Card className="customer-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-start gap-3">
            <IconTile size="sm" tone="muted"><ScrollText /></IconTile>
            <div>
              <h2 className="font-semibold">Your data</h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Export your data, ask for a correction, or request deletion.
                We respond within 30 days under GDPR.
              </p>
            </div>
          </div>
        </div>
        <DsrPanel
          initial={dsrRows.map((r) => ({
            id: r.id,
            kind: r.kind as "export" | "erase" | "rectify",
            status: r.status as "queued" | "processing" | "complete" | "rejected",
            notes: r.notes,
            createdAt: r.createdAt,
            completedAt: r.completedAt,
          }))}
        />
      </Card>
    </div>
  );
}
