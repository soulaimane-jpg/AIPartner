"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminAssignPartner, adminChangeStage } from "@/lib/actions/admin";
import { BRIEF_STAGES, type BriefStage } from "@/lib/enums";

export function AdminStageControls({
  id,
  stage,
}: {
  id: string;
  stage: BriefStage;
}) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState<BriefStage>(stage);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold  text-slate-600 ml-1">Override Protocol</div>
        <Select
          value={val}
          onValueChange={(v) => setVal(v as BriefStage)}
        >
          <SelectTrigger className="h-11 bg-white border-slate-200 text-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 text-slate-900">
            {BRIEF_STAGES.map((s) => (
              <SelectItem key={s} value={s} className="focus:bg-blue-600 focus:text-slate-900 transition-colors uppercase font-mono text-xs tracking-widest">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-slate-900 font-semibold  shadow-sm transition-all"
        disabled={pending || val === stage}
        onClick={() =>
          startTransition(async () => {
            const result = await adminChangeStage({ briefId: id, stage: val });
            if (result.ok) {
              toast.success("Protocol stage synchronized");
            } else {
              toast.error("Protocol error: synchronization failed");
            }
          })
        }
      >
        {pending ? "Synchronizing..." : "Synchronize Stage"}
      </Button>
    </div>
  );
}

export function AdminAssignPartner({
  briefId,
  partners,
}: {
  briefId: string;
  partners: { id: string; name: string }[];
}) {
  const [partnerId, setPartnerId] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      <div className="space-y-2">
        <div className="text-xs font-semibold  text-slate-600 ml-1">Target Aligned Node</div>
        <Select value={partnerId} onValueChange={setPartnerId}>
          <SelectTrigger className="h-11 bg-white border-slate-200 text-slate-900">
            <SelectValue placeholder="Select Partner Node" />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 text-slate-900">
            {partners.map((p) => (
              <SelectItem key={p.id} value={p.id} className="focus:bg-cyan-600 focus:text-slate-900 transition-colors">
                {p.name}
              </SelectItem>
            ))}
            {partners.length === 0 && (
              <SelectItem value="__none__" disabled>
                NO ELIGIBLE NODES
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="w-full h-11 bg-white text-black hover:bg-slate-200 font-semibold  shadow-sm transition-all"
        size="sm"
        disabled={!partnerId || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await adminAssignPartner({ briefId, partnerId });
            if (result.ok) {
              toast.success("Link established between nodes");
              setPartnerId("");
            } else {
              toast.error("Transmission error: link failed");
            }
          })
        }
      >
        <Plus className="h-4 w-4 mr-2" /> Establish Link
      </Button>
    </div>
  );
}
