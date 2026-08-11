import Link from "next/link";
import { CheckCircle2, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <div className="mesh-bg min-h-screen">
      <div className="container py-32 space-y-24 relative overflow-hidden">
        <div className="mx-auto max-w-3xl text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-600 ring-1 ring-inset ring-blue-600/10">
            Commercial Framework
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-950 md:text-7xl lg:text-8xl leading-[0.95]">
            Aligned <br/>
            <span className="text-slate-300">Success</span> <span className="gradient-text italic font-serif serif italic">Models.</span>
          </h1>
          <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-xl mx-auto">
            AI Partner is built on performance-based incentives. Zero cost for companies to explore. Success-based models for our partners.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 relative z-10">
          {/* Companies Plan */}
          <Card className="modern-card group bg-white overflow-hidden p-2">
            <CardContent className="space-y-10 p-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 grid place-items-center inner-glow border border-blue-100/50">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest">Enterprise Discovery</div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-slate-950">$0</span>
                  <span className="text-slate-400 font-medium">upfront</span>
                </div>
                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                  For tech teams seeking elite architecture and vetted engineering partners.
                </p>
              </div>

              <div className="space-y-5">
                {[
                  "AI-Powered Architecture Mapping",
                  "Vetted Premier Partner Network",
                  "Comparative Proposal Matrix",
                  "Real-time Deployment Tracking",
                  "Direct SOW Synchronization",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-4 text-slate-700 font-semibold">
                    <div className="h-5 w-5 rounded-full bg-emerald-50 grid place-items-center border border-emerald-100">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <Button asChild size="xl" className="w-full bg-slate-950 text-white hover:bg-slate-900 rounded-2xl font-bold shadow-xl shadow-slate-950/10 inner-glow">
                <Link href="/auth/sign-up">Start Discovery Session</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Partners Plan */}
          <Card className="modern-card group bg-slate-950 text-white border-none overflow-hidden p-2 shadow-2xl shadow-blue-500/10">
            <CardContent className="space-y-10 p-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-blue-400">
                  <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center">
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest">Partner Protocol</div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">Success</span>
                  <span className="text-slate-400 font-medium ml-2">Fee Only</span>
                </div>
                <p className="text-lg text-slate-400 font-medium leading-relaxed">
                  We only win when you deliver. High-intent technical briefs matched to your stack.
                </p>
              </div>

              <div className="space-y-5">
                {[
                  "Qualified Technical Projects",
                  "Pre-Architected Brief Payloads",
                  "Direct Client Transmissions",
                  "Team Performance Analytics",
                  "Verified Growth Tiering",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-4 text-slate-300 font-semibold">
                    <div className="h-5 w-5 rounded-full bg-white/10 grid place-items-center">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <Button asChild size="xl" className="w-full bg-white text-slate-950 hover:bg-slate-100 rounded-2xl font-bold inner-glow">
                <Link href="/partner/login">Apply as Partner</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-20 text-center relative z-10 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">
            AI Partner Architecture v4.5.0
          </p>
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        </div>
      </div>
    </div>
  );
}
