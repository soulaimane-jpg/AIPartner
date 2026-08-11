"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { upsertFeatureFlagAction } from "@/lib/actions/flags";

const ROLES = ["CUSTOMER", "PARTNER", "ADMIN", "GOOGLER"] as const;

/**
 * Create-or-update form for a feature flag. We deliberately keep this
 * to one form (not two pages) — admins almost always want to tweak an
 * existing flag, and a single flow keeps the UI tight.
 */
export function FlagFormCard() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [rolloutPct, setRolloutPct] = useState(0);
  const [audienceRoles, setAudienceRoles] = useState<string[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [reason, setReason] = useState("");

  function reset() {
    setKey("");
    setDescription("");
    setEnabled(false);
    setRolloutPct(0);
    setAudienceRoles([]);
    setOwnerEmail("");
    setReason("");
  }

  function submit() {
    startTransition(async () => {
      const result = await upsertFeatureFlagAction({
        key: key.trim(),
        description: description.trim() || null,
        enabled,
        rolloutPct,
        audience: audienceRoles.length ? { roles: audienceRoles } : undefined,
        ownerEmail: ownerEmail.trim() || null,
        reason: reason.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Check the form.")
            : result.error.code === "FORBIDDEN"
              ? "Only admins can create flags."
              : "Could not save flag.",
        );
        return;
      }
      toast.success(`Flag ${key} saved`);
      reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        New flag
      </Button>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold">New / update flag</h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="flag-key">Key</Label>
          <Input
            id="flag-key"
            placeholder="e.g. partner.bulk-actions"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Letters, digits, dot, dash, underscore. Used as a stable
            identifier — never rename, only deprecate.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="flag-owner">Owner email</Label>
          <Input
            id="flag-owner"
            type="email"
            placeholder="who owns the cleanup?"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="flag-desc">Description</Label>
        <Input
          id="flag-desc"
          placeholder="What does this flag gate?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 items-end">
        <div className="space-y-1">
          <Label className="block">Enabled</Label>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="flag-pct">Rollout %</Label>
          <Input
            id="flag-pct"
            type="number"
            min={0}
            max={100}
            value={rolloutPct}
            onChange={(e) =>
              setRolloutPct(
                Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              )
            }
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <Label className="block">Roles in audience</Label>
          <div className="flex flex-wrap gap-1">
            {ROLES.map((role) => {
              const active = audienceRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setAudienceRoles((prev) =>
                      active
                        ? prev.filter((r) => r !== role)
                        : [...prev, role],
                    )
                  }
                  className={
                    "px-2 py-1 rounded text-xs font-medium border " +
                    (active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-muted/30 border-muted hover:bg-muted")
                  }
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="flag-reason">Change reason (recorded in audit log)</Label>
        <Input
          id="flag-reason"
          placeholder="e.g. Enabling for ACME pilot"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || !key.trim()}>
          {pending ? "Saving…" : "Save flag"}
        </Button>
      </div>
    </Card>
  );
}
