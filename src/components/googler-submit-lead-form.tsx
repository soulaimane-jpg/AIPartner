"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitLeadAction,
  type SubmitLeadResult,
} from "@/lib/actions/googler";

export function GooglerSubmitLeadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    SubmitLeadResult | undefined,
    FormData
  >(submitLeadAction, undefined);

  useEffect(() => {
    if (state && state.ok) {
      router.push(`/google/leads/${state.leadId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Customer work email"
          id="customerEmail"
          name="customerEmail"
          type="email"
          placeholder="lisa@optiocean.com"
          required
          help="Where the AI Partner invite will be sent."
        />
        <Field
          label="Company domain"
          id="customerDomain"
          name="customerDomain"
          placeholder="optiocean.com"
          required
          help="Used to anonymize the customer for partners."
        />
        <Field
          label="Contact name"
          id="customerName"
          name="customerName"
          placeholder="Lisa Chen"
        />
        <Field
          label="Company name"
          id="companyName"
          name="companyName"
          placeholder="Optiocean"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Internal notes (optional)
        </Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Met at Next. Interested in BigQuery + data migration from AWS."
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground">
          Visible only to you. Never shared with the customer or partners.
        </p>
      </div>

      {state && state.ok === false && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          An invite email will be generated and logged. In production this
          would be sent via your email provider.
        </p>
        <Button type="submit" disabled={pending} className="h-10 px-5">
          {pending ? (
            "Sending invite…"
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" /> Send invite
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  name,
  type = "text",
  placeholder,
  required,
  help,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  placeholder: string;
  required?: boolean;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
      />
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
