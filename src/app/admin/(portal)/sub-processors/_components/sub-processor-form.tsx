"use client";

/**
 * Create form for a new sub-processor.
 *
 * Wraps `createSubProcessor` Server Action. Certifications are entered
 * as comma-separated tokens for ergonomics — we split + trim before
 * sending.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createSubProcessor } from "@/lib/actions/sub-processors";

const REGION_SUGGESTIONS = [
  "EU",
  "US",
  "UK",
  "APAC",
  "Global",
] as const;

export function SubProcessorForm() {
  const [name, setName] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [region, setRegion] = React.useState<string>("EU");
  const [url, setUrl] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [certifications, setCertifications] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState(100);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPurpose("");
    setRegion("EU");
    setUrl("");
    setLogoUrl("");
    setCertifications("");
    setSortOrder(100);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !purpose.trim() || !region.trim()) {
      toast.error("Name, purpose, and region are required.");
      return;
    }

    const certList = certifications
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    startTransition(async () => {
      const result = await createSubProcessor({
        name: name.trim(),
        purpose: purpose.trim(),
        region: region.trim(),
        url: url.trim() || null,
        logoUrl: logoUrl.trim() || null,
        certifications: certList,
        sortOrder,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? "URL must be a valid https:// link."
            : "Couldn't create.",
        );
        return;
      }
      reset();
      toast.success("Sub-processor added.");
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add sub-processor
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stripe"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              required
              maxLength={160}
            />
          </Field>
          <Field label="Region">
            <input
              list="region-suggestions"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              required
              maxLength={80}
            />
            <datalist id="region-suggestions">
              {REGION_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="Purpose" className="md:col-span-2">
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Payment processing for self-serve billing"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              required
              maxLength={400}
            />
          </Field>
          <Field label="Website URL">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://stripe.com"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Logo URL">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/stripe.svg"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Certifications (comma-separated)" className="md:col-span-2">
            <input
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="SOC 2 Type II, PCI DSS, ISO 27001"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={sortOrder}
              min={0}
              max={10_000}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? "Adding…" : "Add sub-processor"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`text-sm font-medium space-y-1 ${className ?? ""}`}>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
