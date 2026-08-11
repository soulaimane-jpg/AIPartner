"use client";

/**
 * Passkey enrolment + revocation UI for the account security page.
 *
 * Flow on enrol:
 *   1. Click "Add passkey" → calls `startPasskeyEnrolmentAction`.
 *   2. Browser prompts for the authenticator (Touch ID, security key…).
 *   3. We send the response back to `verifyPasskeyEnrolmentAction`.
 *   4. On success, refresh the list.
 *
 * Browser support: WebAuthn is available in every modern browser
 * (Safari 14+, Chrome 67+, Firefox 60+). We render a soft-disabled
 * state if the browser lacks the API.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startPasskeyEnrolmentAction,
  verifyPasskeyEnrolmentAction,
  deletePasskeyAction,
} from "@/lib/actions/passkeys";

export type PasskeyRow = {
  id: string;
  label: string;
  aaguid: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function PasskeySection({ initial }: { initial: PasskeyRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [supported, setSupported] = useState<boolean>(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  function enrol() {
    if (!label.trim()) {
      toast.error("Give the passkey a label first.");
      return;
    }
    startTransition(async () => {
      const start = await startPasskeyEnrolmentAction({});
      if (!start.ok) {
        toast.error("Could not start enrolment.");
        return;
      }
      let response: RegistrationResponseJSON;
      try {
        response = await startRegistration({
          // The lib was bumped to v9 — its typing wants `optionsJSON`.
          // Fall back to the legacy positional arg shape too.
          // @ts-expect-error — runtime accepts either shape.
          optionsJSON: start.data,
          ...(typeof start.data === "object" ? (start.data as object) : {}),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "cancelled";
        toast.error(`Enrolment cancelled: ${msg}`);
        return;
      }
      const verify = await verifyPasskeyEnrolmentAction({
        label: label.trim(),
        response,
      });
      if (verify.ok) {
        toast.success("Passkey added");
        setAdding(false);
        setLabel("");
        router.refresh();
      } else {
        toast.error(
          verify.error.code === "INVALID_INPUT"
            ? (verify.error.issues[0]?.message ?? "Could not verify")
            : "Could not verify passkey.",
        );
      }
    });
  }

  function revoke(id: string, lbl: string) {
    if (!window.confirm(`Remove "${lbl}"? You'll lose this sign-in option.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deletePasskeyAction({ id });
      if (result.ok) {
        toast.success("Passkey removed");
        router.refresh();
      } else {
        toast.error("Could not remove.");
      }
    });
  }

  if (!supported) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-[13px] text-muted-foreground">
        Your browser doesn&apos;t support passkeys. Try a recent Safari,
        Chrome, Firefox, or Edge.
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-busy={pending || undefined}>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {initial.length === 0 ? (
          <li className="px-4 py-4 text-[13px] text-muted-foreground italic">
            No passkeys registered yet.
          </li>
        ) : (
          initial.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {p.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Added {new Date(p.createdAt).toLocaleDateString()}
                    {p.lastUsedAt
                      ? ` · last used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                      : " · never used"}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke(p.id, p.label)}
                disabled={pending}
                aria-label={`Remove ${p.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))
        )}
      </ul>

      {adding ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="MacBook Touch ID"
              maxLength={80}
            />
          </div>
          <Button onClick={enrol} disabled={pending} className="w-full sm:w-auto">
            <Fingerprint className="h-3.5 w-3.5" />
            {pending ? "Waiting…" : "Enrol"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setAdding(false)}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          Add passkey
        </Button>
      )}
    </div>
  );
}
