"use client";

/**
 * Data subject rights panel (GDPR / UK-GDPR).
 *
 * Three buttons + a recent-requests table. Each click opens a small
 * confirmation prompt, then files a `DsrRequest`. The actual fulfilment
 * runs in a background job — within 30 days, surfaced to admins.
 *
 * Erasure is destructive — the confirmation copy is intentionally
 * blunt. We deliberately *don't* require step-up MFA on submit because
 * we want this surface frictionless; the destructive cascade only runs
 * after the admin re-verifies the user's identity out-of-band.
 */

import { useState, useTransition } from "react";
import { Download, Trash2, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  submitDsrRequestAction,
  cancelDsrRequestAction,
} from "@/lib/actions/dsr";

export interface DsrRow {
  id: string;
  kind: "export" | "erase" | "rectify";
  status: "queued" | "processing" | "complete" | "rejected";
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

const KIND_META = {
  export: {
    title: "Download my data",
    description:
      "Get a JSON bundle of every record we hold about you. Delivered to your email when ready.",
    icon: Download,
  },
  erase: {
    title: "Delete my account",
    description:
      "Permanently delete your account and personal data. Briefs you own are anonymised; audit logs are retained for compliance.",
    icon: Trash2,
  },
  rectify: {
    title: "Fix incorrect data",
    description:
      "Tell us what's wrong or out of date and we'll correct it.",
    icon: FileEdit,
  },
} as const;

export function DsrPanel({ initial }: { initial: DsrRow[] }) {
  const [rows, setRows] = useState<DsrRow[]>(initial);
  const [rectifyOpen, setRectifyOpen] = useState(false);
  const [rectifyText, setRectifyText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(kind: "export" | "erase" | "rectify", notes?: string) {
    startTransition(async () => {
      const result = await submitDsrRequestAction({ kind, notes });
      if (result.ok) {
        toast.success("Request received — we'll be in touch");
        setRows((prev) => [
          {
            id: result.data.id,
            kind,
            status: "queued",
            notes: notes ?? null,
            createdAt: new Date(),
            completedAt: null,
          },
          ...prev,
        ]);
        setRectifyOpen(false);
        setRectifyText("");
      } else {
        toast.error(
          result.error.code === "CONFLICT" && "reason" in result.error
            ? result.error.reason
            : result.error.code === "INVALID_INPUT"
              ? (result.error.issues[0]?.message ?? "Validation failed")
              : "Could not submit request",
        );
      }
    });
  }

  function cancel(id: string) {
    if (!window.confirm("Cancel this request?")) return;
    startTransition(async () => {
      const result = await cancelDsrRequestAction({ id });
      if (result.ok) {
        toast.success("Cancelled");
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "rejected", completedAt: new Date() }
              : r,
          ),
        );
      } else {
        toast.error(
          result.error.code === "CONFLICT" && "reason" in result.error
            ? result.error.reason
            : "Could not cancel",
        );
      }
    });
  }

  return (
    <section aria-label="Your data" className="space-y-4" aria-busy={pending || undefined}>
      <div className="grid sm:grid-cols-3 gap-3">
        {(["export", "rectify", "erase"] as const).map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          const danger = kind === "erase";
          return (
            <div
              key={kind}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={
                    danger ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"
                  }
                />
                <h3 className="text-sm font-medium">{meta.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground flex-1">
                {meta.description}
              </p>
              {kind === "rectify" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRectifyOpen((v) => !v)}
                  disabled={pending}
                >
                  Start request
                </Button>
              ) : kind === "erase" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-destructive sm:w-auto"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete your account and personal data? This cannot be undone.",
                      )
                    ) {
                      submit("erase");
                    }
                  }}
                >
                  Request deletion
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => submit("export")}
                  disabled={pending}
                  className="w-full sm:w-auto"
                >
                  Request export
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {rectifyOpen && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Describe what&apos;s wrong and the correction you&apos;d like. We&apos;ll
            confirm by email.
          </p>
          <Textarea
            value={rectifyText}
            onChange={(e) => setRectifyText(e.target.value)}
            rows={3}
            maxLength={4000}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRectifyOpen(false);
                setRectifyText("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || rectifyText.trim().length < 2}
              onClick={() => submit("rectify", rectifyText.trim())}
            >
              {pending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Your requests
          </h3>
          <ul className="rounded-xl border border-border bg-card divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium capitalize">{r.kind}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(r.createdAt)}
                  </div>
                </div>
                <Badge
                  tone={
                    r.status === "complete"
                      ? "success"
                      : r.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                  shape="soft"
                  size="sm"
                  uppercase
                >
                  {r.status}
                </Badge>
                {r.status === "queued" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancel(r.id)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
