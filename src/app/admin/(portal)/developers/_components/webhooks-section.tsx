"use client";

/**
 * Webhooks section — admin view.
 *
 * Provides a create form, a per-row list with status/last-delivery, and
 * inline actions: rotate secret (single-view), pause/resume, test, delete.
 *
 * Event picker: empty selection means "subscribe to all events". That
 * matches the server-side semantic: the dispatch function treats an
 * empty events array as a wildcard.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Copy,
  AlertCircle,
  RotateCw,
  Pause,
  Play,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
} from "@/lib/actions/webhooks";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

export interface WebhookRow {
  id: string;
  companyId: string;
  companyName: string;
  url: string;
  description: string | null;
  events: string[];
  status: string;
  lastDeliveryAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFails: number;
  createdAt: string;
}

export function WebhooksSection(props: {
  companies: Array<{ id: string; name: string; kind: string }>;
  defaultCompanyId: string | null;
  endpoints: WebhookRow[];
}) {
  const [companyId, setCompanyId] = React.useState(
    props.defaultCompanyId ?? props.companies[0]?.id ?? "",
  );
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [revealedSecret, setRevealedSecret] = React.useState<{
    id: string;
    secret: string;
  } | null>(null);

  function toggleEvent(e: string) {
    setSelectedEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  function onCreate() {
    if (!companyId || !url.trim()) {
      toast.error("Tenant + URL are required.");
      return;
    }
    startTransition(async () => {
      const result = await createWebhook({
        companyId,
        url: url.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        events: selectedEvents,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? "URL is invalid — must be HTTPS and publicly reachable."
            : "Couldn't create the webhook.",
        );
        return;
      }
      setRevealedSecret({
        id: result.data.id,
        secret: result.data.secret,
      });
      setUrl("");
      setDescription("");
      setSelectedEvents([]);
      toast.success("Webhook created. Copy the secret now.");
    });
  }

  function onToggleStatus(row: WebhookRow) {
    const next = row.status === "active" ? "paused" : "active";
    startTransition(async () => {
      const result = await updateWebhook({
        companyId: row.companyId,
        id: row.id,
        status: next,
      });
      if (!result.ok) {
        toast.error("Couldn't update status.");
        return;
      }
      toast.success(`Webhook ${next}.`);
    });
  }

  function onRotate(row: WebhookRow) {
    if (
      !confirm(
        `Rotate the signing secret for ${row.url}? The previous secret stops working immediately.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await rotateWebhookSecret({
        companyId: row.companyId,
        id: row.id,
      });
      if (!result.ok) {
        toast.error("Rotate failed.");
        return;
      }
      setRevealedSecret({
        id: row.id,
        secret: result.data.secret,
      });
      toast.success("Secret rotated. Copy it now.");
    });
  }

  function onTest(row: WebhookRow) {
    startTransition(async () => {
      const result = await testWebhook({
        companyId: row.companyId,
        id: row.id,
      });
      if (!result.ok) {
        toast.error("Couldn't enqueue the test event.");
        return;
      }
      toast.success("Test event queued — check the delivery log shortly.");
    });
  }

  function onDelete(row: WebhookRow) {
    if (!confirm(`Delete the webhook to ${row.url}? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteWebhook({
        companyId: row.companyId,
        id: row.id,
      });
      if (!result.ok) {
        toast.error("Delete failed.");
        return;
      }
      toast.success("Webhook deleted.");
    });
  }

  return (
    <div className="space-y-4">
      {revealedSecret && (
        <Card className="p-5 border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-emerald-700 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-emerald-900">
                Save this signing secret now
              </h3>
              <p className="text-sm text-emerald-800">
                Sign each incoming HMAC against this string. Won&rsquo;t be
                shown again — rotate to get a new one.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-white p-2">
                <code className="font-mono text-sm flex-1 truncate">
                  {revealedSecret.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedSecret.secret);
                    toast.success("Copied");
                  }}
                  className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRevealedSecret(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 underline"
              >
                I&rsquo;ve saved it — dismiss
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Tenant
            </span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {props.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              URL (HTTPS)
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/aipartner-hook"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm font-medium space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Description
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Slack notify on match.accepted"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm font-medium space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Events ({selectedEvents.length === 0 ? "all" : selectedEvents.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEvent(e)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                    selectedEvents.includes(e)
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Empty selection subscribes to all events.
            </p>
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Webhook className="h-4 w-4" />
            {pending ? "Creating…" : "Add endpoint"}
          </button>
        </div>
      </Card>

      {props.endpoints.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No webhook endpoints yet.
        </Card>
      ) : (
        <div className="grid gap-3">
          {props.endpoints.map((w) => (
            <Card key={w.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{w.companyName}</Badge>
                    <code className="font-mono text-sm font-medium truncate max-w-[480px]">
                      {w.url}
                    </code>
                    <Badge
                      variant={
                        w.status === "active"
                          ? "default"
                          : w.status === "paused"
                            ? "secondary"
                            : "warning"
                      }
                    >
                      {w.status}
                    </Badge>
                    {w.consecutiveFails > 0 && (
                      <Badge variant="warning" className="text-[10px]">
                        {w.consecutiveFails} consecutive fails
                      </Badge>
                    )}
                  </div>
                  {w.description && (
                    <p className="text-xs text-muted-foreground">
                      {w.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {w.events.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">
                        all events
                      </Badge>
                    ) : (
                      w.events.map((e) => (
                        <Badge key={e} variant="outline" className="text-[10px]">
                          {e}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    last delivery:{" "}
                    {w.lastDeliveryAt
                      ? new Date(w.lastDeliveryAt).toLocaleString()
                      : "never"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <ToolbarBtn onClick={() => onTest(w)} disabled={pending}>
                    <Send className="h-3 w-3" />
                    Test
                  </ToolbarBtn>
                  <ToolbarBtn
                    onClick={() => onToggleStatus(w)}
                    disabled={pending || w.status === "disabled"}
                  >
                    {w.status === "active" ? (
                      <>
                        <Pause className="h-3 w-3" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Resume
                      </>
                    )}
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => onRotate(w)} disabled={pending}>
                    <RotateCw className="h-3 w-3" />
                    Rotate
                  </ToolbarBtn>
                  <ToolbarBtn
                    onClick={() => onDelete(w)}
                    disabled={pending}
                    danger
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </ToolbarBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
