"use client";

/**
 * API keys section — admin view.
 *
 * Two responsibilities:
 *   1. **Create form** — operator picks a tenant, name, scopes; raw
 *      key is shown exactly once in a dismissable banner.
 *   2. **Table** — list active + revoked keys with last-used + revoke
 *      action.
 *
 * The "shown once" raw-key banner is the single hard-to-get-right bit:
 * once dismissed, the operator must rotate to get a new one.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, ShieldOff, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createApiKey, revokeApiKey } from "@/lib/actions/public-api-keys";

const ALL_SCOPES = [
  "briefs:read",
  "briefs:write",
  "matches:read",
  "matches:write",
  "proposals:read",
  "proposals:write",
  "directory:read",
  "subprocessors:read",
] as const;

export interface ApiKeyRow {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  rateLimitRpm: number | null;
  ipAllowlist: string[];
  createdAt: string;
  revokedAt: string | null;
}

export function ApiKeysSection(props: {
  companies: Array<{ id: string; name: string; kind: string }>;
  defaultCompanyId: string | null;
  keys: ApiKeyRow[];
}) {
  const [companyId, setCompanyId] = React.useState(
    props.defaultCompanyId ?? props.companies[0]?.id ?? "",
  );
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["briefs:read"]);
  const [expiresAt, setExpiresAt] = React.useState("");
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = React.useState<{
    raw: string;
    prefix: string;
  } | null>(null);

  function toggleScope(s: string) {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function onCreate() {
    if (!companyId) {
      toast.error("Pick a tenant first.");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Pick at least one scope.");
      return;
    }
    startTransition(async () => {
      const result = await createApiKey({
        companyId,
        name: name.trim(),
        scopes,
        ...(expiresAt
          ? { expiresAt: new Date(expiresAt).toISOString() }
          : {}),
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "FORBIDDEN"
            ? "Only admins can mint keys."
            : "Couldn't create the key.",
        );
        return;
      }
      setRevealed({ raw: result.data.raw, prefix: result.data.prefix });
      setName("");
      setScopes(["briefs:read"]);
      setExpiresAt("");
      toast.success("API key created. Copy it now — it won't be shown again.");
    });
  }

  function onRevoke(row: ApiKeyRow) {
    if (
      !confirm(
        `Revoke ${row.name} (${row.prefix}…) for ${row.companyName}? This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revokeApiKey({
        companyId: row.companyId,
        id: row.id,
      });
      if (!result.ok) {
        toast.error("Couldn't revoke the key.");
        return;
      }
      toast.success("Key revoked.");
    });
  }

  return (
    <div className="space-y-4">
      {revealed && (
        <Card className="p-5 border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-emerald-700 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-emerald-900">
                Save this key now
              </h3>
              <p className="text-sm text-emerald-800">
                We&rsquo;ll never display it again. Anyone with this string
                can call the API as the tenant.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-card p-2">
                <code className="font-mono text-sm flex-1 truncate">
                  {revealed.raw}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed.raw);
                    toast.success("Copied to clipboard");
                  }}
                  className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRevealed(null)}
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
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Salesforce CRM sync"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm font-medium space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Scopes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                    scopes.includes(s)
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-card text-foreground ring-border hover:bg-primary/5"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
          <label className="text-sm font-medium space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Expires (optional)
            </span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {pending ? "Creating…" : "Mint API key"}
          </button>
        </div>
      </Card>

      {props.keys.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No API keys yet.
        </Card>
      ) : (
        <div className="customer-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Tenant</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Prefix</th>
                <th className="px-4 py-2 font-medium">Scopes</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last used</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {props.keys.map((k) => (
                <tr key={k.id} className="border-t">
                  <td className="px-4 py-2 truncate max-w-[160px]">
                    {k.companyName}
                  </td>
                  <td className="px-4 py-2 font-medium">{k.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{k.prefix}…</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                      {k.scopes.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{k.scopes.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={k.status === "active" ? "default" : "secondary"}
                    >
                      {k.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleDateString()
                      : "never"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {k.status === "active" && (
                      <button
                        type="button"
                        onClick={() => onRevoke(k)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <ShieldOff className="h-3 w-3" />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
