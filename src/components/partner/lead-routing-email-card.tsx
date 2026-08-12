"use client";

import { useState, useTransition } from "react";
import { Mail, Save, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { updateLeadRoutingEmailAction } from "@/lib/actions/partner";

/**
 * Card embedded on the partner dashboard + profile page. Drives the
 * preferred email partners want new opportunity outreach sent to.
 * Nudges the partner when empty.
 */
export function LeadRoutingEmailCard({
  initialEmail,
}: {
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateLeadRoutingEmailAction({
        leadRoutingEmail: email.trim(),
      });
      if (result.ok) {
        setSavedEmail(email.trim());
        toast.success("Routing email saved");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not save",
        );
      }
    });
  }

  const isEmpty = !savedEmail;

  return (
    <div
      className={`rounded-xl border p-5 ${
        isEmpty
          ? "border-amber-200 bg-amber-50/60"
          : "border-line bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-10 w-10 place-items-center rounded-lg shrink-0 ${
            isEmpty ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
          }`}
        >
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">
              Lead-routing email
            </h3>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Where new opportunity invitations should be sent — e.g.{" "}
              <code className="font-mono">sales@yourcompany.com</code>.
            </p>
          </div>
          <FormField
            label="Email address"
            htmlFor="lead-routing-email"
            helper={
              isEmpty
                ? "Without this, outreach will go to the original recipient only. Set it now to centralise."
                : undefined
            }
          >
            <Input
              id="lead-routing-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@yourcompany.com"
            />
          </FormField>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={pending || email === savedEmail}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : email && email !== savedEmail ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {pending
                ? "Saving"
                : email === savedEmail
                  ? "Saved"
                  : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
