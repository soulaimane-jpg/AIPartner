"use client";

import Link from "next/link";
import { FileText, Clock, DollarSign, Calendar, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, safeJsonParse, timeAgo } from "@/lib/utils";

type MatchItem = {
  id: string;
  status: string;
  updatedAt: string;
  briefId: string;
  briefTitle: string;
  briefStage: string;
  briefServices: string;
  proposalStatus: string | null;
  proposalTotalCost: number | null;
  proposalTimelineWeeks: number | null;
};

export function PartnerTabs({
  open,
  inProgress,
  submitted,
  active,
}: {
  open: MatchItem[];
  inProgress: MatchItem[];
  submitted: MatchItem[];
  active: MatchItem[];
}) {
  const tabs = [
    { value: "open", label: "Discovery", count: open.length },
    { value: "progress", label: "Drafting", count: inProgress.length },
    { value: "submitted", label: "Pipeline", count: submitted.length },
    { value: "engagements", label: "Active", count: active.length },
  ];

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Tabs defaultValue="open" className="w-full">
        <div className="mb-6">
          <TabsList className="h-12 bg-secondary border border-border rounded-xl p-1 gap-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-lg px-5 h-full font-semibold text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-magenta-1/15 text-magenta-1 text-[10px] font-bold">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="open" className="mt-0 outline-none">
          <MatchList matches={open} empty="No discovery briefs available." cta="View Brief" />
        </TabsContent>
        <TabsContent value="progress" className="mt-0 outline-none">
          <MatchList matches={inProgress} empty="No drafts in progress." cta="Resume Draft" />
        </TabsContent>
        <TabsContent value="submitted" className="mt-0 outline-none">
          <MatchList matches={submitted} empty="No submitted proposals." cta="View Proposal" />
        </TabsContent>
        <TabsContent value="engagements" className="mt-0 outline-none">
          <MatchList matches={active} empty="No active engagements." cta="View SOW" />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function MatchList({
  matches,
  empty,
  cta,
}: {
  matches: MatchItem[];
  empty: string;
  cta: string;
}) {
  if (matches.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-secondary/20 shadow-none">
        <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary border border-border text-muted-foreground mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-muted-foreground font-medium text-sm">{empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {matches.map((m, i) => {
        const services = safeJsonParse<string[]>(m.briefServices, []);
        return (
          <Card
            key={m.id}
            className="modern-card group animate-card-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-magenta-1/40 via-magenta-1/15 to-transparent" />
            <CardContent className="p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-magenta-1 transition-colors">
                      {m.briefTitle}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                      {m.briefStage}
                    </Badge>
                    {m.proposalStatus && (
                      <Badge variant="info" className="text-[10px]">
                        {m.proposalStatus}
                      </Badge>
                    )}
                  </div>

                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-magenta-1/70" />
                      {timeAgo(new Date(m.updatedAt))}
                    </span>
                    {m.proposalTotalCost != null && (
                      <span className="flex items-center gap-1.5 text-success font-semibold">
                        <DollarSign className="h-3.5 w-3.5" />
                        {formatCurrency(m.proposalTotalCost)}
                      </span>
                    )}
                    {m.proposalTimelineWeeks && (
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Calendar className="h-3.5 w-3.5 text-magenta-1/70" />
                        {m.proposalTimelineWeeks}w
                      </span>
                    )}
                  </div>
                </div>

                <Button asChild variant="outline" className="h-10 px-6 font-semibold rounded-xl shrink-0">
                  <Link href={`/partner/briefs/${m.briefId}`}>
                    {cta}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
