"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminUpsertPartnerContactAction,
  adminDeletePartnerContactAction,
} from "@/lib/actions/partner-admin";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string;
  isPrimary: boolean;
}

/**
 * M5.2 — contact persons per partner. The primary contact receives
 * lead-routing notifications for invites.
 */
export function PartnerContactsManager({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", role: "", email: "" });

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setAdding(false);
        setForm({ name: "", role: "", email: "" });
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error as never));
      }
    });
  };

  return (
    <section className="rounded-lg border border-border bg-background p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">
            Contact persons
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            The primary contact receives lead invitations (lead routing).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          disabled={pending}
        >
          <Plus className="h-3.5 w-3.5" /> Add contact
        </Button>
      </header>

      {contacts.length === 0 && !adding && (
        <p className="text-[13px] text-muted-foreground italic">
          No contacts yet — invites fall back to the partner&apos;s portal
          users.
        </p>
      )}

      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-foreground">
                  {c.name}
                </span>
                {c.isPrimary && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    <Star className="h-2.5 w-2.5" /> Lead routing
                  </Badge>
                )}
              </div>
              <div className="text-[12px] text-muted-foreground truncate">
                {c.role ? `${c.role} · ` : ""}
                {c.email}
              </div>
            </div>
            {!c.isPrimary && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    adminUpsertPartnerContactAction({
                      companyId,
                      contactId: c.id,
                      name: c.name,
                      role: c.role ?? undefined,
                      email: c.email,
                      isPrimary: true,
                    }),
                  )
                }
              >
                Make primary
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-red-600 hover:text-red-700"
              onClick={() =>
                run(() =>
                  adminDeletePartnerContactAction({ companyId, contactId: c.id }),
                )
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      {adding && (
        <div className="rounded-md border border-border bg-secondary/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Role (optional)"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && (
            <p className="text-[12.5px] text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || !form.name || !form.email}
              onClick={() =>
                run(() =>
                  adminUpsertPartnerContactAction({
                    companyId,
                    name: form.name,
                    role: form.role || undefined,
                    email: form.email,
                    isPrimary: contacts.length === 0,
                  }),
                )
              }
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save contact
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
