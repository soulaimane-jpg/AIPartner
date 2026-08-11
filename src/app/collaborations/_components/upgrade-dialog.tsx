"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upgradeCollaboratorToCustomerAction } from "@/lib/actions/auth";
import type { AuthState } from "@/lib/types/auth";

/**
 * Collaborator → Customer upgrade dialog.
 *
 * Collects the same fields the regular customer sign-up asks for
 * (company / role / location), submits to
 * `upgradeCollaboratorToCustomerAction`, which flips the role + creates
 * a Company and redirects to /dashboard.
 */
export function UpgradeToCustomerDialog({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<AuthState, FormData>(
    upgradeCollaboratorToCustomerAction,
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" />
            Start your own project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-[16px]">
                Start your own project
              </DialogTitle>
              <DialogDescription className="mt-1 text-[12.5px]">
                We&apos;ll create a customer workspace for you. Existing
                collaborations stay intact — you keep access to the briefs
                you were invited to.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form action={formAction} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-[12.5px]">
              Company name
            </Label>
            <Input
              id="companyName"
              name="companyName"
              required
              placeholder="Acme Inc."
              autoComplete="organization"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle" className="text-[12.5px]">
                Your role
              </Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                required
                placeholder="VP Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-[12.5px]">
                Location
              </Label>
              <Input
                id="location"
                name="location"
                required
                placeholder="Amsterdam, NL"
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-[12.5px] text-destructive">{state.error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      Create workspace
    </Button>
  );
}
