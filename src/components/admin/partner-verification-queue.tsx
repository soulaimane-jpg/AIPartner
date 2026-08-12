"use client";

/**
 * Admin vetting queue for self-registered partners.
 *
 * Partners land here as PENDING and are invisible to sourcing and
 * invites until approved. The domain-evidence chip is a signal for the
 * reviewer — approval is always an explicit human decision.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, ShieldX, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approvePartnerAction,
  rejectPartnerAction,
} from "@/lib/actions/partner-verification";

export type PendingPartner = {
  id: string;
  name: string;
  createdAt: string;
  signupEmailDomain: string | null;
  website: string | null;
  directoryUrl: string | null;
  domainMatches: boolean;
  domainReason: string;
  contactEmails: string[];
  usersCount: number;
};

const DOMAIN_REASON_COPY: Record<string, string> = {
  matches_website: "Signup domain matches the profile website",
  generic_email_domain: "Signed up with a free email provider",
  no_website_on_file: "No website or directory URL on the profile",
  no_match: "Signup domain does not match the profile website",
};

export function PartnerVerificationQueue({
  partners,
}: {
  partners: PendingPartner[];
}) {
  if (partners.length === 0) {
    return (
      <Card className="customer-panel bg-card">
        <CardHeader className="customer-panel-header">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
            Partner verification
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 text-sm text-foreground/70">
            No partners awaiting verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="customer-panel border-amber-200 bg-card">
      <CardHeader className="border-b border-amber-200 bg-amber-50/60 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wider">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Partner verification — {partners.length} awaiting review
        </CardTitle>
        <p className="mt-1 text-xs text-foreground/70">
          Unverified partners cannot be sourced, invited, or shown to any
          customer.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-line">
          {partners.map((p) => (
            <PendingRow key={p.id} partner={p} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingRow({ partner }: { partner: PendingPartner }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePartnerAction({ partnerId: partner.id });
      if (result.ok) {
        toast.success(`${partner.name} verified`);
        router.refresh();
      } else {
        toast.error(
          "reason" in result.error && result.error.reason
            ? result.error.reason
            : "Could not approve partner",
        );
      }
    });
  }

  function handleReject() {
    if (reason.trim().length < 5) {
      toast.error("Give a reason so the partner can fix it");
      return;
    }
    startTransition(async () => {
      const result = await rejectPartnerAction({
        partnerId: partner.id,
        reason: reason.trim(),
      });
      if (result.ok) {
        toast.success(`${partner.name} rejected`);
        setRejecting(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(
          "reason" in result.error && result.error.reason
            ? result.error.reason
            : "Could not reject partner",
        );
      }
    });
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">{partner.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
            <Badge
              variant="outline"
              className={
                partner.domainMatches
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }
            >
              {partner.domainMatches ? "Domain verified" : "Domain unverified"}
            </Badge>
            <span>
              {DOMAIN_REASON_COPY[partner.domainReason] ?? partner.domainReason}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            {partner.signupEmailDomain && (
              <span>Signup domain: @{partner.signupEmailDomain}</span>
            )}
            {partner.website && (
              <a
                href={partner.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Website
              </a>
            )}
            {partner.directoryUrl && (
              <a
                href={partner.directoryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Partner directory
              </a>
            )}
            <span>{partner.usersCount} user(s)</span>
          </div>
          {partner.contactEmails.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Contacts: {partner.contactEmails.join(", ")}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={handleApprove} disabled={pending}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejecting((v) => !v)}
            disabled={pending}
          >
            <ShieldX className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </div>

      {rejecting && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/50 p-3 sm:flex-row">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this partner rejected? The partner sees this."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button size="sm" variant="destructive" onClick={handleReject} disabled={pending}>
            Confirm rejection
          </Button>
        </div>
      )}
    </div>
  );
}
