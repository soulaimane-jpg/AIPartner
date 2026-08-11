"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { submitPartnerProposalAction } from "@/lib/actions/proposals";
import { safeJsonParse } from "@/lib/utils";

type Team = { role: string; seniority?: string; count?: number };
type ProposalLike = {
  id?: string;
  summary?: string | null;
  approach?: string | null;
  timelineWeeks?: number | null;
  totalCost?: number | null;
  strengths?: string | null;
  teamComposition?: string | null;
  status?: string | null;
} | null;

export function ProposalForm({
  briefId,
  proposal,
}: {
  briefId: string;
  proposal?: ProposalLike;
}) {
  const [summary, setSummary] = useState(proposal?.summary ?? "");
  const [approach, setApproach] = useState(proposal?.approach ?? "");
  const [timelineWeeks, setTimelineWeeks] = useState(
    proposal?.timelineWeeks?.toString() ?? "",
  );
  const [totalCost, setTotalCost] = useState(
    proposal?.totalCost ? Math.round(proposal.totalCost / 100).toString() : "",
  );
  const [strengthsStr, setStrengthsStr] = useState(
    safeJsonParse<string[]>(proposal?.strengths ?? "[]", []).join("\n"),
  );
  const [team, setTeam] = useState<Team[]>(
    safeJsonParse<Team[]>(proposal?.teamComposition ?? "[]", []),
  );
  const [pending, startTransition] = useTransition();

  const addTeam = () =>
    setTeam((t) => [...t, { role: "", seniority: "Senior", count: 1 }]);
  const removeTeam = (i: number) => setTeam((t) => t.filter((_, idx) => idx !== i));
  const updateTeam = (i: number, patch: Partial<Team>) =>
    setTeam((t) => t.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const submit = () => {
    const strengths = strengthsStr
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const result = await submitPartnerProposalAction({
        briefId,
        summary,
        approach,
        timelineWeeks,
        totalCost,
        strengths,
        team,
      });
      if (result.ok) {
        toast.success("SOW transmitted successfully");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : result.error.code === "FORBIDDEN" && "reason" in result.error
              ? result.error.reason
              : "Transmission failed",
        );
      }
    });
  };

  return (
    <div className="space-y-8 text-sm">
      {proposal?.status === "SUBMITTED" && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-xs font-semibold  text-blue-600">
          Proposal Locked & Transmitted. Updates are still permitted.
        </div>
      )}
      {proposal?.status === "SELECTED" && (
        <Badge variant="premium" className="w-full justify-center h-10 rounded-xl text-xs font-semibold tracking-[0.2em]">MISSION ACCOMPLISHED — SELECTED 🎉</Badge>
      )}
      
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="summary" className="text-xs font-semibold  text-slate-600 ml-1">Mission Summary</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Executive overview of your technical approach..."
            className="min-h-[100px] bg-white border-slate-200 text-slate-900 focus-visible:ring-indigo-500/50 rounded-2xl"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="approach" className="text-xs font-semibold  text-slate-600 ml-1">Engineering Strategy</Label>
          <Textarea
            id="approach"
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            placeholder="Phases, methodologies, and delivery milestones..."
            className="min-h-[140px] bg-white border-slate-200 text-slate-900 focus-visible:ring-indigo-500/50 rounded-2xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timeline" className="text-xs font-semibold  text-slate-600 ml-1">Timeline (Weeks)</Label>
            <Input
              id="timeline"
              type="number"
              min={1}
              value={timelineWeeks}
              onChange={(e) => setTimelineWeeks(e.target.value)}
              placeholder="12"
              className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost" className="text-xs font-semibold  text-slate-600 ml-1">Contract Value (USD)</Label>
            <Input
              id="cost"
              type="number"
              min={0}
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              placeholder="85000"
              className="bg-white border-slate-200 text-slate-900 rounded-xl h-12 font-mono"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between ml-1">
            <Label className="text-xs font-semibold  text-slate-600">Assigned Squad</Label>
            <Button variant="ghost" size="sm" type="button" onClick={addTeam} className="h-6 text-xs font-semibold  text-blue-600 hover:bg-blue-50">
              <Plus className="h-3 w-3 mr-1" /> Add Role
            </Button>
          </div>
          <div className="space-y-3">
            {team.map((m, i) => (
              <div key={i} className="flex gap-2 items-center bg-slate-50 border border-slate-200 p-3 rounded-2xl group transition-all hover:border-slate-200">
                <Input
                  placeholder="Role"
                  value={m.role}
                  onChange={(e) => updateTeam(i, { role: e.target.value })}
                  className="bg-transparent border-0 focus-visible:ring-0 h-8 text-xs font-bold"
                />
                <div className="h-4 w-[1px] bg-white/10"></div>
                <Input
                  placeholder="Lvl"
                  value={m.seniority ?? ""}
                  onChange={(e) => updateTeam(i, { seniority: e.target.value })}
                  className="bg-transparent border-0 focus-visible:ring-0 h-8 text-xs w-20 text-slate-500"
                />
                <div className="h-4 w-[1px] bg-white/10"></div>
                <Input
                  type="number"
                  min={1}
                  value={m.count ?? 1}
                  onChange={(e) => updateTeam(i, { count: Number(e.target.value) })}
                  className="bg-transparent border-0 focus-visible:ring-0 h-8 text-xs w-12 font-mono text-blue-600 text-right"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => removeTeam(i)}
                  className="h-8 w-8 text-slate-700 hover:text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {team.length === 0 && (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs font-mono text-slate-700 ">
                [ NO PERSONNEL ASSIGNED ]
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="strengths" className="text-xs font-semibold  text-slate-600 ml-1">Competitive Advantages</Label>
          <Textarea
            id="strengths"
            value={strengthsStr}
            onChange={(e) => setStrengthsStr(e.target.value)}
            rows={3}
            placeholder="Deep enterprise AI experience&#10;Premier tier engineering partner&#10;Proprietary migration toolkit"
            className="bg-white border-slate-200 text-slate-900 rounded-2xl"
          />
          <p className="text-xs font-mono text-slate-700  ml-1">Input one advantage per line</p>
        </div>

        <Button onClick={submit} disabled={pending || summary.trim().length < 5} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold  shadow-sm mt-4">
          {pending ? "Transmitting..." : proposal?.status === "SUBMITTED" ? "Re-Transmit Proposal" : "Initialize SOW Submission"}
        </Button>
      </div>
    </div>
  );
}
