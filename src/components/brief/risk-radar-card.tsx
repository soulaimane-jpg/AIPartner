"use client";

/**
 * Risk Radar card — shown above the submit CTA on the brief preview.
 *
 * Three states:
 *   1. **Not yet run** — "Scan this brief for problems" CTA.
 *   2. **Run, no blockers** — green hairline summary + button to re-scan.
 *   3. **Run, has findings** — list with severity dots; on `block`,
 *      shows an "Acknowledge" affordance the customer must click before
 *      `brief.submit` will accept the request.
 */

import { useState, useTransition } from "react";
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Info,
  RotateCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runRiskRadarAction,
  acknowledgeRiskRadarAction,
} from "@/lib/actions/risk-radar";

export type RiskFinding = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warn" | "block";
  category: string;
  fieldHints: string[];
  suggestion?: string;
};

export type RiskRadarSnapshot = {
  id: string;
  /**
   * `failed` is written when the model call itself didn't complete. The
   * submit gate treats it like a blocker so an AI outage can't silently
   * remove the pre-submit review — but the customer can acknowledge it
   * and proceed, so an outage doesn't hard-stop the funnel either.
   */
  overall: "info" | "warn" | "block" | "failed";
  findings: RiskFinding[];
  acknowledgedAt: Date | null;
  /**
   * True when the brief has been edited since this report was produced.
   * The server re-checks the brief hash, so a stale pass is not a pass.
   */
  stale?: boolean;
};

const SEVERITY_META: Record<
  "info" | "warn" | "block" | "failed",
  { label: string; tone: "neutral" | "warning" | "danger"; icon: typeof Info }
> = {
  info: { label: "Note", tone: "neutral", icon: Info },
  warn: { label: "Warning", tone: "warning", icon: AlertTriangle },
  block: { label: "Blocker", tone: "danger", icon: ShieldAlert },
  failed: { label: "Didn't complete", tone: "warning", icon: AlertTriangle },
};

export function RiskRadarCard({
  briefId,
  initial,
}: {
  briefId: string;
  initial: RiskRadarSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<RiskRadarSnapshot | null>(initial);
  const [pending, startTransition] = useTransition();

  function run(force: boolean) {
    startTransition(async () => {
      const result = await runRiskRadarAction({ briefId, force });
      if (!result.ok) {
        toast.error(
          result.error.code === "LLM_FAILURE"
            ? "The AI reviewer is unavailable. Try again shortly."
            : "Could not run the radar.",
        );
        return;
      }
      // We re-fetch via reload of the parent server component path; for
      // immediate UX we set a coarse snapshot from the action result.
      setSnapshot((prev) => ({
        id: result.data.reportId,
        overall: result.data.overall,
        // Findings will repopulate on next server render.
        findings: prev?.findings ?? [],
        acknowledgedAt: null,
      }));
      toast.success(
        result.data.fromCache ? "Cached report ready" : "Risk Radar finished",
      );
    });
  }

  function acknowledge() {
    if (!snapshot) return;
    startTransition(async () => {
      const result = await acknowledgeRiskRadarAction({
        reportId: snapshot.id,
      });
      if (!result.ok) {
        toast.error("Could not acknowledge.");
        return;
      }
      setSnapshot({ ...snapshot, acknowledgedAt: new Date() });
      toast.success("Acknowledged");
    });
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Risk Radar</div>
            <p className="text-xs text-muted-foreground">
              Have the AI reviewer scan your brief for missing context,
              contradictions, and unrealistic asks before partners see
              it.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => run(false)} disabled={pending}>
          {pending ? "Scanning…" : "Scan"}
        </Button>
      </div>
    );
  }

  const meta = SEVERITY_META[snapshot.overall];
  const Icon = meta.icon;
  // A failed run is not a pass: it must be re-run or explicitly
  // acknowledged, exactly like a blocker.
  const needsAck =
    (snapshot.overall === "block" || snapshot.overall === "failed") &&
    !snapshot.acknowledgedAt;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        needsAck ? "border-destructive/40 bg-destructive/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`h-4 w-4 shrink-0 ${
              snapshot.overall === "block"
                ? "text-destructive"
                : snapshot.overall === "warn"
                  ? "text-amber-500"
                  : "text-muted-foreground"
            }`}
          />
          <div className="text-sm font-medium">Risk Radar</div>
          <Badge tone={meta.tone} shape="soft" uppercase size="sm">
            {meta.label}
          </Badge>
          {snapshot.acknowledgedAt && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Acknowledged
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => run(true)}
          disabled={pending}
        >
          <RotateCw className="h-3.5 w-3.5" />
          Re-scan
        </Button>
      </div>

      {snapshot.findings.length > 0 && (
        <ul className="space-y-2">
          {snapshot.findings.map((f) => {
            const fMeta = SEVERITY_META[f.severity];
            const FIcon = fMeta.icon;
            return (
              <li
                key={f.id}
                className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm flex gap-3"
              >
                <FIcon
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    f.severity === "block"
                      ? "text-destructive"
                      : f.severity === "warn"
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f.detail}
                  </p>
                  {f.suggestion && (
                    <p className="text-xs mt-1">
                      <span className="font-medium">Try:</span> {f.suggestion}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {snapshot.findings.length === 0 && snapshot.overall === "info" && (
        <p className="text-xs text-muted-foreground">
          No issues spotted. The brief looks ready to send to partners.
        </p>
      )}

      {snapshot.overall === "failed" && (
        <p className="text-xs text-muted-foreground">
          The AI reviewer couldn&apos;t finish this scan. Re-scan when you
          can, or acknowledge to send without it.
        </p>
      )}

      {snapshot.stale && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">
            You&apos;ve edited the brief since this scan, so it no longer
            reflects what partners would see. Re-scan before sending.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(true)}
            disabled={pending}
          >
            Re-scan
          </Button>
        </div>
      )}

      {needsAck && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2">
          <p className="text-xs text-destructive">
            {snapshot.overall === "failed"
              ? "We won't send this to partners until the review runs, or you acknowledge sending without it."
              : "We won't send this to partners until you address the blockers or acknowledge you've read them."}
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={acknowledge}
            disabled={pending}
          >
            Acknowledge
          </Button>
        </div>
      )}
    </div>
  );
}
