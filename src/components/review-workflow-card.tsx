"use client";

import { useActionState, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveBriefReviewWorkflowAction,
  type SaveReviewWorkflowResult,
} from "@/lib/actions/briefs";

export type ReviewWorkflowInitial = {
  reviewWorkflowConfirmed: boolean;
  requiresInternalReview: boolean;
  internalReviewerName: string | null;
  internalReviewerEmail: string | null;
  internalReviewerRole: string | null;
  reviewWorkflowNotes: string | null;
};

const REVIEWER_ROLE_OPTIONS = [
  { value: "VIEWER", label: "Viewer — can view and leave notes" },
  { value: "EDITOR", label: "Editor — can edit, approve, or reject" },
] as const;

export function ReviewWorkflowCard({
  briefId,
  initial,
}: {
  briefId: string;
  initial: ReviewWorkflowInitial;
}) {
  const [editing, setEditing] = useState(!initial.reviewWorkflowConfirmed);
  const [requiresReview, setRequiresReview] = useState(
    initial.requiresInternalReview,
  );
  const [state, formAction, pending] = useActionState<
    SaveReviewWorkflowResult | undefined,
    FormData
  >(async (prev, fd) => {
    const result = await saveBriefReviewWorkflowAction(prev, fd);
    if (result.ok) setEditing(false);
    return result;
  }, undefined);

  if (!editing && initial.reviewWorkflowConfirmed) {
    return (
      <ConfirmedView
        initial={initial}
        requiresReview={initial.requiresInternalReview}
        onEdit={() => setEditing(true)}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Internal review &amp; approval
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Before we share this SoW with partners, confirm whether anyone on
              your side needs to review or approve it first. Required to submit.
            </p>
          </div>
        </div>
        {!initial.reviewWorkflowConfirmed && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md">
            Required
          </span>
        )}
      </header>

      <form action={formAction} className="p-6 space-y-6">
        <input type="hidden" name="briefId" value={briefId} />

        {/* REVIEW */}
        <ToggleSection
          title="Does someone on your team need to review this SoW before it goes to partners?"
          name="requiresInternalReview"
          checked={requiresReview}
          onChange={setRequiresReview}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Reviewer name"
              name="internalReviewerName"
              placeholder="Jane Doe"
              defaultValue={initial.internalReviewerName ?? ""}
            />
            <TextField
              label="Reviewer email"
              name="internalReviewerEmail"
              type="email"
              placeholder="jane@company.com"
              defaultValue={initial.internalReviewerEmail ?? ""}
            />
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="internalReviewerRole"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Reviewer role
              </Label>
              <select
                id="internalReviewerRole"
                name="internalReviewerRole"
                defaultValue={initial.internalReviewerRole ?? "VIEWER"}
                className="flex h-9 w-full rounded-md border border-border bg-card text-[13.5px] px-3 shadow-[var(--elev-1)] focus-visible:outline-none focus-visible:border-primary"
              >
                {REVIEWER_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                An invitation email will be sent to the reviewer. They can sign up if needed and will be added as a collaborator on this brief.
              </p>
            </div>
          </div>
        </ToggleSection>

        <div className="space-y-1.5">
          <Label
            htmlFor="reviewWorkflowNotes"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Anything else we should know? (optional)
          </Label>
          <Textarea
            id="reviewWorkflowNotes"
            name="reviewWorkflowNotes"
            rows={3}
            placeholder="e.g. Legal will sign the MSA. Security must review partner SOC2 before kickoff."
            defaultValue={initial.reviewWorkflowNotes ?? ""}
          />
        </div>

        {state && state.ok === false && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Only visible to you and your AI Partner admin. Partners do not see
            reviewer identities.
          </p>
          <div className="flex items-center gap-2">
            {initial.reviewWorkflowConfirmed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save review workflow"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ConfirmedView({
  initial,
  requiresReview,
  onEdit,
}: {
  initial: ReviewWorkflowInitial;
  requiresReview: boolean;
  onEdit: () => void;
}) {
  return (
    <section className="rounded-2xl border border-success/20 bg-success/[0.03] overflow-hidden">
      <header className="px-6 py-4 border-b border-success/15 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/10 text-success">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              Internal review &amp; approval confirmed
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              You&apos;re ready to submit this SoW for partner sourcing.
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-8">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </header>

      <div className="p-6 grid gap-4 sm:grid-cols-2">
        <PersonBlock
          icon={ShieldCheck}
          label="Reviewer"
          active={requiresReview}
          name={initial.internalReviewerName}
          email={initial.internalReviewerEmail}
          role={initial.internalReviewerRole === "EDITOR" ? "Editor" : "Viewer"}
          emptyText="No internal review required"
        />
        {initial.reviewWorkflowNotes && (
          <div className="sm:col-span-2 rounded-lg border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Notes
            </div>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {initial.reviewWorkflowNotes}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function PersonBlock({
  icon: Icon,
  label,
  active,
  name,
  email,
  role,
  emptyText,
}: {
  icon: typeof ShieldCheck;
  label: string;
  active: boolean;
  name: string | null;
  email: string | null;
  role: string | null;
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      {active ? (
        <div className="mt-2 space-y-0.5">
          <div className="text-sm font-semibold text-foreground">
            {name ?? "—"}
          </div>
          {email && (
            <div className="text-xs text-muted-foreground">{email}</div>
          )}
          {role && (
            <div className="text-xs text-muted-foreground">{role}</div>
          )}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground italic">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function ToggleSection({
  title,
  name,
  checked,
  onChange,
  children,
}: {
  title: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-5 space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
        />
        <span className="text-sm font-semibold text-foreground leading-snug">
          {title}
        </span>
      </label>
      {checked && <div className="pl-7">{children}</div>}
    </div>
  );
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  fullWidth,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  defaultValue?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <Label
        htmlFor={name}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </div>
  );
}
