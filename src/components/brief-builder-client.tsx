"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BriefChat,
  type BriefChatHandle,
  type ChatViewer,
} from "@/components/brief-chat";
import { BriefFeedbackPanel } from "@/components/brief-feedback-panel";
import { SowExamplesDrawer } from "@/components/sow-examples-drawer";
import type { CompletionSection } from "@/lib/brief";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  meta?: string | null;
};

export function BriefBuilderClient({
  briefId,
  completion,
  sections,
  initialMessages,
  previewHref,
  viewer,
}: {
  briefId: string;
  completion: number;
  sections: CompletionSection[];
  initialMessages: Msg[];
  previewHref: string;
  viewer?: ChatViewer;
}) {
  const chatRef = useRef<BriefChatHandle>(null);
  const completeSections = sections.filter((section) => section.weight > 0 && section.score >= section.weight).length;

  return (
    <div className="space-y-4">
      <div className="customer-panel flex items-center gap-4 p-4 xl:hidden">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-semibold text-foreground">Brief readiness</span>
            <span className="font-mono text-[12px] font-semibold tabular-nums text-primary">{completion}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{completeSections} of {sections.length} sections ready</p>
        </div>
      </div>

      <div className="grid min-h-[680px] gap-5 xl:h-[calc(100vh-17rem)] xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <BriefChat
          ref={chatRef}
          briefId={briefId}
          initialMessages={initialMessages}
          sections={sections}
          completion={completion}
          viewer={viewer}
          headerActions={
            <>
              <SowExamplesDrawer triggerLabel="Examples" triggerVariant="ghost" />
              <BriefFeedbackPanel
                briefId={briefId}
                completion={completion}
                onAskQuestion={(q) => chatRef.current?.prefill(q)}
              />
              <Button asChild size="sm">
                <Link href={previewHref}>
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Generate SOW</span>
                  <span className="sm:hidden">Review</span>
                  <ArrowRight className="hidden h-3.5 w-3.5 sm:block" />
                </Link>
              </Button>
            </>
          }
        />

        <ReadinessPanel completion={completion} sections={sections} className="hidden xl:block" />
      </div>
    </div>
  );
}

function ReadinessPanel({
  completion,
  sections,
  className,
}: {
  completion: number;
  sections: CompletionSection[];
  className?: string;
}) {
  return (
    <aside className={cn("h-full overflow-y-auto rounded-2xl border border-border bg-card shadow-elev-1", className)}>
      <div className="border-b border-border bg-[linear-gradient(145deg,hsl(var(--primary)/0.09),hsl(var(--card))_65%)] px-5 py-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          <Target className="h-3.5 w-3.5" />
          Brief readiness
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-foreground">{completion}%</div>
          <div className="pb-0.5 text-[11.5px] text-muted-foreground">ready to review</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${completion}%` }} />
        </div>
      </div>
      <div className="space-y-1 p-3">
        {sections.map((section) => {
          const complete = section.weight > 0 && section.score >= section.weight;
          return (
            <div key={section.key} className="rounded-xl px-3 py-3 transition-colors hover:bg-secondary/45">
              <div className="flex items-start gap-2.5">
                {complete ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-foreground">{section.label}</span>
                    <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {section.score}/{section.weight}
                    </span>
                  </div>
                  {!complete && section.missing.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      Next: {section.missing[0]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
