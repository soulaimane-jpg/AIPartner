"use client";

/**
 * M6 — admin invite pipeline controls on the brief detail page:
 *   - mark the sourced set as PARTNERS_SELECTED
 *   - send invites (T1 starts; optional per-lead T2 override)
 *   - resolve extension requests
 * Match rows show placeholder labels, statuses and live deadlines.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Users, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminSelectPartnersAction,
  adminSendInvitesAction,
  adminResolveExtensionAction,
} from "@/lib/actions/invites";
import { mapErrorToToast } from "@/lib/schemas/errors";

export interface InviteMatchRow {
  matchId: string;
  partnerId: string;
  partnerName: string;
  placeholderLabel: string | null;
  status: string;
  acceptDeadlineAt: string | null;
  proposalDeadlineAt: string | null;
  extensionUsed: boolean;
  extensionNote: string | null;
}

const ACTIVE_STATUSES = new Set([
  "INVITED",
  "PARTNER_ACCEPTED",
  "EXTENSION_REQUESTED",
  "PROPOSAL_SUBMITTED",
  "QC_PASSED",
]);

export function InviteControls({
  briefId,
  leadState,
  matches,
}: {
  briefId: string;
  leadState: string;
  matches: InviteMatchRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [t2Override, setT2Override] = React.useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error as never));
    });
  };

  const sourced = matches.filter((m) => m.status === "SOURCED");
  const showSelect =
    (leadState === "LEAD_APPROVED" || leadState === "STALLED") &&
    sourced.length > 0;
  const showSend = leadState === "PARTNERS_SELECTED" && sourced.length > 0;

  return (
    <div className="rounded-lg border border-border bg-background p-5 space-y-4">
      <header className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[14px] font-semibold text-foreground">
          Invites &amp; timers
        </h2>
        <Badge variant="outline" className="ml-auto font-mono text-[10px] uppercase tracking-wider">
          {leadState}
        </Badge>
      </header>

      {matches.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          No partners sourced yet — use the sourcing wizard above.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {matches.map((m) => (
            <li key={m.matchId} className="py-2.5 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-foreground">
                  {m.partnerName}
                </span>
                {m.placeholderLabel && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {m.placeholderLabel}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider ${
                    ACTIVE_STATUSES.has(m.status)
                      ? "border-emerald-300 text-emerald-700"
                      : ""
                  }`}
                >
                  {m.status}
                </Badge>
                <span className="ml-auto text-[11.5px] font-mono text-muted-foreground">
                  {m.status === "INVITED" && m.acceptDeadlineAt
                    ? `T1 → ${new Date(m.acceptDeadlineAt).toLocaleString()}`
                    : (m.status === "PARTNER_ACCEPTED" ||
                          m.status === "EXTENSION_REQUESTED") &&
                        m.proposalDeadlineAt
                      ? `T2 → ${new Date(m.proposalDeadlineAt).toLocaleString()}`
                      : ""}
                </span>
              </div>

              {m.status === "EXTENSION_REQUESTED" && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-2">
                  <p className="text-[12.5px] text-amber-900">
                    <span className="font-medium">Extension requested.</span>{" "}
                    {m.extensionNote ? `Status note: "${m.extensionNote}"` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          adminResolveExtensionAction({
                            matchId: m.matchId,
                            grant: true,
                          }),
                        )
                      }
                    >
                      <Check className="h-3.5 w-3.5" /> Grant
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          adminResolveExtensionAction({
                            matchId: m.matchId,
                            grant: false,
                          }),
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" /> Deny
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showSelect && (
        <Button
          disabled={pending}
          onClick={() =>
            run(() =>
              adminSelectPartnersAction({
                briefId,
                partnerIds: sourced.map((m) => m.partnerId),
              }),
            )
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          Confirm {sourced.length} partner{sourced.length === 1 ? "" : "s"} for
          this lead
        </Button>
      )}

      {showSend && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              run(() =>
                adminSendInvitesAction({
                  briefId,
                  proposalHoursOverride: t2Override
                    ? Number(t2Override)
                    : undefined,
                }),
              )
            }
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send invites (T1 starts)
          </Button>
          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            T2 override (hours):
            <input
              type="number"
              min={4}
              max={336}
              value={t2Override}
              onChange={(e) => setT2Override(e.target.value)}
              placeholder="default"
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
