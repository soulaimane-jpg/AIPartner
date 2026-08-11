"use client";

import * as React from "react";
import { m } from "framer-motion";
import {
  Bot,
  Check,
  Cloud,
  FileText,
  Fingerprint,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

export function HeroProductStage() {
  return (
    <m.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.2, ease }}
      className="home-product-stage"
    >
      <div className="home-product-glow" aria-hidden />
      <div className="home-product-window">
        <div className="home-product-topbar">
          <div className="flex gap-1.5" aria-hidden>
            <span className="home-window-dot bg-[#ff5f57]" />
            <span className="home-window-dot bg-[#ffbd2e]" />
            <span className="home-window-dot bg-[#28c940]" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Partner intelligence</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" /> Live
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-2xl bg-[hsl(224_55%_10%)] p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><ScanSearch className="h-4 w-4 text-cyan-300" /></span>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/55">Scanning</span>
            </div>
            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">Match confidence</div>
              <div className="mt-1 flex items-end gap-2"><span className="text-4xl font-semibold tracking-[-0.05em]">94</span><span className="mb-1 text-sm text-cyan-300">%</span></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <m.div initial={{ scaleX: 0 }} animate={{ scaleX: 0.94 }} transition={{ duration: 1.4, delay: 0.7, ease }} className="h-full origin-left rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" />
              </div>
            </div>
            <div className="mt-7 space-y-2">
              {["Architecture fit", "Commercial model", "Delivery profile"].map((label, index) => (
                <div key={label} className="flex items-center justify-between text-[10px] text-white/65">
                  <span>{label}</span><span className="font-mono text-white/90">{[96, 92, 94][index]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recommended shortlist</div><div className="mt-0.5 text-sm font-semibold text-foreground">Best-fit partners</div></div>
              <Sparkles className="h-4 w-4 text-magenta-1" />
            </div>
            {[94, 89, 86].map((score, index) => (
              <m.div key={score} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.55 + index * 0.12, ease }} className={cn("flex items-center gap-3 rounded-2xl border p-3", index === 0 ? "border-magenta-1/40 bg-magenta-1/[0.06] shadow-elev-2" : "border-line bg-white")}>
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl text-xs font-semibold", index === 0 ? "bg-brand-gradient text-white" : "bg-secondary text-foreground")}>{String.fromCharCode(65 + index)}</span>
                <div className="min-w-0 flex-1"><div className="h-2 w-24 rounded-full bg-foreground/80" /><div className="mt-2 flex gap-1">{[0, 1, 2, 3, 4].map((bar) => <span key={bar} className={cn("h-1 flex-1 rounded-full", bar < 5 - index ? "bg-brand-3" : "bg-line")} />)}</div></div>
                <span className="font-mono text-xs font-semibold text-foreground">{score}%</span>
              </m.div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-line bg-[hsl(36_22%_97%)]">
          {["Shortlist", "Proposals", "Comparison"].map((label, index) => <div key={label} className="flex items-center gap-2 border-r border-line px-3 py-3 text-[10px] font-medium text-muted-foreground last:border-r-0"><span className={cn("grid h-5 w-5 place-items-center rounded-full", index === 0 ? "bg-success text-white" : "bg-white text-subtle shadow-elev-1")}>{index === 0 ? <Check className="h-3 w-3" /> : index + 1}</span>{label}</div>)}
        </div>
      </div>
      <m.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }} className="home-float-card home-float-card-left">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-magenta-gradient text-white"><Bot className="h-4 w-4" /></span>
        <div><div className="text-[10px] text-muted-foreground">AI recommendation</div><div className="text-xs font-semibold text-foreground">3 strongest fits</div></div>
      </m.div>
      <m.div animate={{ y: [0, 7, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} className="home-float-card home-float-card-right">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success"><FileText className="h-4 w-4" /></span>
        <div><div className="text-[10px] text-muted-foreground">Proposal matrix</div><div className="text-xs font-semibold text-foreground">Ready to compare</div></div>
      </m.div>
    </m.div>
  );
}

export function EcosystemVisual() {
  const nodes = [Cloud, Sparkles, Network, Fingerprint];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]">
      <div className="absolute inset-[16%] rounded-full border border-brand-3/15" />
      <div className="absolute inset-[28%] rounded-full border border-dashed border-magenta-1/25 animate-[spin_45s_linear_infinite] motion-reduce:animate-none" />
      <div className="absolute inset-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl bg-[hsl(224_55%_10%)] text-white shadow-elev-4"><Network className="h-9 w-9" /></div>
      {nodes.map((Icon, index) => {
        const positions = ["left-[8%] top-[38%]", "right-[12%] top-[12%]", "right-[4%] bottom-[24%]", "left-[22%] bottom-[7%]"];
        return <m.div key={index} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.1, duration: 0.55, ease }} className={cn("absolute grid h-16 w-16 place-items-center rounded-2xl border border-white/70 bg-white/80 text-brand-2 shadow-elev-3 backdrop-blur-xl", positions[index])}><Icon className="h-6 w-6" /></m.div>;
      })}
      <svg aria-hidden viewBox="0 0 500 500" className="absolute inset-0 h-full w-full text-brand-3/20"><path d="M86 225 C160 120 295 95 390 140 M390 140 C448 245 402 348 352 378 M352 378 C220 442 130 350 86 225" fill="none" stroke="currentColor" strokeDasharray="5 7" /></svg>
    </div>
  );
}

export function ProductDashboardInterlude() {
  return (
    <ScrollStage className="home-dashboard-shell">
      <div className="home-dashboard-sidebar">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white"><Sparkles className="h-4 w-4" /></div>
        <div className="mt-8 space-y-3">{[0, 1, 2, 3].map((item) => <div key={item} className={cn("h-8 rounded-lg", item === 1 ? "bg-white/10" : "bg-white/[0.04]")} />)}</div>
      </div>
      <div className="min-w-0 bg-[hsl(36_25%_98%)] p-4 sm:p-6">
        <div className="flex items-center justify-between"><div><div className="h-2 w-24 rounded bg-foreground/30" /><div className="mt-2 h-3 w-44 rounded bg-foreground/80" /></div><div className="rounded-full bg-success/10 px-3 py-1.5 text-[10px] font-semibold text-success">Comparison ready</div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-elev-2">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-line bg-secondary/70 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><div className="p-3">Criteria</div><div className="border-l border-line p-3">Partner A</div><div className="border-l border-line p-3 text-brand-3">Partner B</div></div>
            {["Technical fit", "Commercial", "Timeline", "Team"].map((row, index) => <div key={row} className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-line text-[10px] last:border-b-0"><div className="p-3 text-muted-foreground">{row}</div><div className="border-l border-line p-3 font-medium">{[88, 84, 91, 86][index]}%</div><div className="flex items-center gap-1 border-l border-line bg-brand-3/[0.04] p-3 font-semibold text-brand-3">{[96, 92, 94, 93][index]}% <Check className="h-3 w-3" /></div></div>)}
          </div>
          <div className="rounded-2xl bg-[hsl(224_55%_10%)] p-5 text-white shadow-elev-3"><div className="flex items-center justify-between"><ShieldCheck className="h-5 w-5 text-cyan-300" /><span className="text-[9px] uppercase tracking-[0.12em] text-white/45">Top match</span></div><div className="mt-8 text-5xl font-semibold tracking-[-0.06em]">94%</div><div className="mt-2 text-xs text-white/55">Overall alignment</div><div className="mt-6 space-y-2">{[0.96, 0.92, 0.94].map((width, index) => <div key={index} className="h-1.5 overflow-hidden rounded-full bg-white/10"><m.div initial={{ scaleX: 0 }} whileInView={{ scaleX: width }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.3 + index * 0.12, ease }} className="h-full origin-left rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" /></div>)}</div></div>
        </div>
      </div>
    </ScrollStage>
  );
}

export function PrivacyShieldVisual() {
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[390px] place-items-center">
      <div className="absolute inset-[8%] rounded-full border border-white/10" />
      <div className="absolute inset-[20%] rounded-full border border-dashed border-cyan-300/20 animate-[spin_38s_linear_infinite_reverse] motion-reduce:animate-none" />
      <div className="absolute inset-[31%] rounded-full bg-cyan-400/10 blur-2xl" />
      <m.div animate={{ y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative grid h-36 w-36 place-items-center rounded-[2.5rem] border border-white/15 bg-white/[0.08] shadow-[0_30px_80px_-20px_hsl(188_92%_48%/0.45)] backdrop-blur-xl"><ShieldCheck className="h-16 w-16 text-cyan-300" /></m.div>
      {[LockKeyhole, Fingerprint, Check].map((Icon, index) => { const positions = ["left-[5%] top-[45%]", "right-[9%] top-[18%]", "right-[2%] bottom-[20%]"]; return <div key={index} className={cn("absolute grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-white/80 backdrop-blur-xl", positions[index])}><Icon className="h-5 w-5" /></div>; })}
    </div>
  );
}

function ScrollStage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <m.div initial={{ opacity: 0, y: 32, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, ease }} className={className}>{children}</m.div>;
}
