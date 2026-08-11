import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  GraduationCap,
  HandCoins,
  Headphones,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurveAccents } from "@/components/marketing/curve-accents";
import {
  EcosystemVisual,
  HeroProductStage,
  PrivacyShieldVisual,
  ProductDashboardInterlude,
} from "@/components/marketing/premium-home-visuals";
import { ProcessTimeline } from "@/components/marketing/process-timeline";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

export const metadata: Metadata = {
  title: "Find the Right Google Cloud Partner | AI Partner",
  description:
    "A free, confidential service matching GCP customers with the right Google Cloud partner for migration, AI, security, managed services, support, and training.",
};

const PARTNER_BENEFITS = [
  {
    icon: UsersRound,
    title: "Tailored Attention & Real-World Experience",
    body: "Google corporate cannot provide daily, hyper-personalized engineering support. Partners offer deep, agile technical expertise and see what actually works on the ground every day across dozens of live customer environments. They know the practical workarounds, edge cases, and real-world deployment challenges that a product company might miss.",
  },
  {
    icon: HandCoins,
    title: "Commercial & Discount Flexibility",
    body: "Buying directly from Google often ties you to rigid, standardized contracts. Partners unlock significant economies of scale, flexible billing mechanisms such as tailored invoicing cycles, unique Google funding opportunities, and highly optimized pricing models that lower your overall commit risk.",
  },
  {
    icon: Clock3,
    title: "Immediate Speed & Cost Efficiency",
    body: "Navigating Google’s internal professional services can involve lengthy delays, resource scarcity, and higher daily rates. Partners are more cost-effective, can deploy certified engineers quickly, and often bring proprietary code libraries and technology accelerators to shorten delivery.",
  },
] as const;

const CAPABILITIES = [
  {
    icon: BadgeDollarSign,
    title: "Reselling",
    subtitle: "Billing & Commercial Optimization",
    description: "A partner optimizes your financial relationship with Google Cloud—handling invoicing, unlocking volume credits, and maximizing your commercial efficiency.",
    deliverable: "Strategic commercial structuring designed to maximize ROI, lower commit risk, and balance discounts with the flexibility you need.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Consulting",
    subtitle: "Project Delivery",
    description: "Hands-on engineering to execute specific milestones, including solution architecture, cloud migrations, data and AI platforms, and security implementations.",
    deliverable: "Scoping documents with defined deliverables, timelines, and fixed or Time & Materials (T&M) pricing.",
  },
  {
    icon: Settings2,
    title: "Managed Services",
    subtitle: "Ongoing Operations",
    description: "Continuous day-to-day management of your cloud environment after launch, including proactive monitoring, patching, optimization, and incident response.",
    deliverable: "Long-term service contracts backed by clear Service Level Agreements (SLAs).",
  },
  {
    icon: Headphones,
    title: "Support",
    subtitle: "Reactive Assistance",
    description: "Ticket-based, break-fix coverage offering L1–L4 escalation when things go wrong—a lighter, cost-effective alternative to Managed Services.",
    deliverable: "On-demand access to technical experts when you need answers or troubleshooting.",
  },
  {
    icon: GraduationCap,
    title: "Training & Enablement",
    subtitle: "Team Development",
    description: "Upskill your internal team through customized technical workshops, hands-on labs, and Google Cloud certification preparation.",
    deliverable: "A tailored course catalog with flexible delivery formats priced per cohort.",
  },
] as const;

const PROCESS_STEPS = [
  ["Profile Creation", "Tell us about your company and your current Google Cloud footprint."],
  ["Brief & Preferences", "Outline your technical goals, timeline, budget, and ideal partner traits."],
  ["Anonymized Sourcing", "Our team and platform scan the GCP ecosystem to source the best matches—without revealing your identity to the market."],
  ["Receive Proposals", "Review up to 5 blind proposals detailing technical approaches, capabilities, and estimated costs."],
  ["Introduction Meetings", "Select up to 3 partners to break anonymity, evaluate team chemistry, and fine-tune project scopes."],
  ["Final Comparison", "Evaluate side-by-side matrices on cost, technical fit, and alignment to pick your winning partner."],
  ["Guided Contracting", "Sign directly with your chosen partner. Our team provides input and guidance to help you secure the best possible terms."],
] as const;

const PRIVACY_GUARANTEES = [
  {
    icon: LockKeyhole,
    title: "Anonymity by Default",
    body: "Your company name, contact details, and specific infrastructure traits are hidden during the initial market-sourcing phase.",
  },
  {
    icon: CheckCircle2,
    title: "Absolute Control",
    body: "Partners only receive your data and identity after you explicitly approve them for an introduction meeting.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Environment",
    body: "All project briefs and corporate profiles are securely processed and isolated, keeping your data private throughout the matching lifecycle.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="home-premium flex flex-col overflow-hidden">

      <section className="home-hero relative isolate overflow-hidden text-white">
        <div aria-hidden className="home-hero-ambient" />
        <div aria-hidden className="home-hero-grid" />
        <div aria-hidden className="home-hero-beam home-hero-beam-one" />
        <div aria-hidden className="home-hero-beam home-hero-beam-two" />
        <div aria-hidden className="home-hero-orbit" />
        <div aria-hidden className="bg-noise opacity-35" />
        <div className="relative container-wide py-16 sm:py-20 lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:items-center lg:py-14">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(540px,1.12fr)] lg:gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(620px,1.1fr)] xl:gap-14">
            <div className="home-hero-copy max-w-[720px]">
              <ScrollReveal delay={0.08} y={24}>
                <h1 className="home-hero-title mt-7">
                  <span className="sr-only">Build, Migrate, and Scale Strategically and Cost-Efficiently on Google Cloud.</span>
                  <span aria-hidden>Build, Migrate, and Scale <span className="home-hero-title-accent">Strategically and Cost-Efficiently</span> on Google Cloud.</span>
                </h1>
              </ScrollReveal>
              <ScrollReveal delay={0.16} y={20}>
                <p className="home-hero-summary mt-7">
                  Finding the right GCP partner shouldn&apos;t take weeks of manual vetting. We help you source, compare, and select the ideal partner for your technical and financial needs. Blending automated intelligence with decades of internal Google and partner-network expertise, we provide a hands-off, unbiased matchmaking service to maximize your cloud value from brief to final contract.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.24} y={16}>
                <div className="home-hero-action mt-9">
                  <Button asChild variant="pill-magenta" size="xl" className="home-primary-cta h-14 px-8 text-[13px] sm:px-9">
                    <Link href="/auth/sign-up">
                      Find Your Partner
                      <ArrowRight className="h-4 w-4 transition-transform duration-240 group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                  <p className="home-hero-microcopy">
                    <span aria-hidden>⚡</span> 100% free for GCP customers. Fully confidential until you choose to connect.
                  </p>
                </div>
              </ScrollReveal>
            </div>
            <div className="home-hero-visual relative -mx-3 sm:mx-0">
              <div aria-hidden className="home-hero-visual-frame" />
              <HeroProductStage />
            </div>
          </div>
        </div>
        <div aria-hidden className="home-hero-bottom-line" />
      </section>

      <section id="trust" className="home-section scroll-mt-24 bg-background">
        <div className="container-app py-24 lg:py-36">
          <div className="grid items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-20">
            <ScrollReveal className="max-w-2xl">
              <p className="home-eyebrow">Experience on your side</p>
              <h2 className="home-section-title mt-4">Built by Google Cloud and Partner Insiders</h2>
              <div className="mt-8 space-y-6 text-[16px] leading-[1.8] text-muted-foreground sm:text-[18px]">
                <p>AIPartner was founded by individuals who spent years working inside Google, within top-tier GCP partner organizations, and as independent cloud consultants. Having guided businesses ranging from fast-growing SMBs to massive enterprises, we know exactly how the ecosystem works, where the hidden costs lie, and which partners actually deliver on their promises.</p>
                <p>We aren&apos;t just an isolated AI chatbot—our experienced team is with you along the entire journey, acting as your behind-the-scenes advocates to ensure you get the best technical and commercial fit.</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.12} y={28}><EcosystemVisual /></ScrollReveal>
          </div>
          <div aria-hidden className="home-ecosystem-strip mt-16">
            {["01", "02", "03", "04", "05", "06"].map((item) => <span key={item} className="home-ecosystem-mark"><span className="h-2 w-2 rounded-full bg-current opacity-60" /><span className="h-px w-10 bg-current opacity-20" />{item}</span>)}
          </div>
        </div>
      </section>

      <section id="benefits" className="home-section home-benefits-bg scroll-mt-24">
        <div className="container-app py-24 lg:py-36">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div><p className="home-eyebrow">The partner advantage</p><h2 className="home-section-title mt-4">Why Work with a GCP Partner vs. Google Directly?</h2></div>
            <p className="max-w-2xl text-[16px] leading-[1.75] text-muted-foreground lg:justify-self-end lg:text-[18px]">Google Cloud builds world-class infrastructure, but it is fundamentally a product company, not a service company. Its internal teams focus on the global platform, leaving a critical gap in hands-on execution, bespoke architecture, and localized commercial terms. A dedicated partner bridges this gap.</p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PARTNER_BENEFITS.map(({ icon: Icon, title, body }, index) => (
              <ScrollReveal key={title} delay={index * 0.09} className="h-full">
                <article className="home-premium-card group h-full">
                  <div className="flex items-start justify-between"><span className="home-card-icon"><Icon className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" /></span><span className="font-mono text-xs text-subtle">0{index + 1}</span></div>
                  <h3 className="mt-8 text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-foreground">{title}</h3>
                  <p className="mt-4 text-[14px] leading-[1.75] text-muted-foreground sm:text-[15px]">{body}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="home-section scroll-mt-24 bg-background">
        <div className="container-app py-24 lg:py-36">
          <div className="mx-auto max-w-4xl text-center"><p className="home-eyebrow">Five engagement models</p><h2 className="home-section-title mt-4">How Partners Add Value to Your Cloud Journey</h2><p className="mx-auto mt-6 max-w-2xl text-[16px] leading-[1.75] text-muted-foreground sm:text-[18px]">Whether you need a simple billing transition or a multi-year AI overhaul, we match you with partners specializing in five core disciplines.</p></div>
          <div className="home-capability-rail mt-14">
            {CAPABILITIES.map(({ icon: Icon, title, subtitle, description, deliverable }, index) => (
              <ScrollReveal key={title} delay={index * 0.06} className={index < 3 ? "home-capability-card lg:col-span-2" : "home-capability-card lg:col-span-3"}>
                <article className="group flex h-full flex-col rounded-[1.75rem] border border-line bg-white p-7 shadow-elev-1 transition-[transform,box-shadow,border-color] duration-240 hover:-translate-y-1.5 hover:border-brand-3/30 hover:shadow-elev-4 sm:p-8">
                  <span className="home-card-icon"><Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" /></span>
                  <h3 className="mt-7 text-[22px] font-semibold tracking-[-0.025em] text-foreground">{title}</h3><p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-magenta-1">{subtitle}</p>
                  <p className="mt-5 text-[14px] leading-[1.7] text-muted-foreground"><strong className="text-foreground">What it is: </strong>{description}</p>
                  <p className="mt-4 border-t border-line/70 pt-4 text-[14px] leading-[1.7] text-muted-foreground"><strong className="text-foreground">The deliverable: </strong>{deliverable}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="process" className="home-section home-process-bg scroll-mt-24">
        <div className="container-wide py-24 lg:py-36">
          <div className="mx-auto max-w-4xl text-center"><p className="home-eyebrow">A clear path to the right fit</p><h2 className="home-section-title mt-4">Our Process: How We Find Your Match</h2><p className="mt-6 text-[16px] leading-[1.75] text-muted-foreground sm:text-[18px]">A hands-off, stress-free sourcing journey tailored entirely to your requirements.</p></div>
          <ProcessTimeline steps={PROCESS_STEPS} />
          <p className="mx-auto mt-10 max-w-3xl rounded-full border border-magenta-1/20 bg-white/80 px-6 py-4 text-center text-sm font-medium text-foreground shadow-elev-2 backdrop-blur-xl"><strong>100% free for your organization.</strong> We are compensated entirely by the partner network.</p>
          <div aria-hidden className="mt-20"><ProductDashboardInterlude /></div>
        </div>
      </section>

      <section id="privacy" className="home-privacy relative isolate scroll-mt-24 overflow-hidden text-white">
        <div aria-hidden className="home-privacy-glow" /><div aria-hidden className="bg-noise" />
        <div className="relative container-app py-24 lg:py-36">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.78fr] lg:gap-20">
            <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-cyan-300">Consent-first by design</p><h2 className="home-section-title mt-4 text-white">Enterprise-Grade Confidentiality</h2><p className="mt-6 max-w-2xl text-[16px] leading-[1.75] text-white/65 sm:text-[18px]">Your cloud strategy and architecture are highly proprietary, and we treat them that way. AIPartner operates on a strict, consent-first data model.</p></div>
            <PrivacyShieldVisual />
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PRIVACY_GUARANTEES.map(({ icon: Icon, title, body }, index) => (
              <ScrollReveal key={title} delay={index * 0.08} className="h-full"><article className="home-privacy-card group h-full"><Icon className="h-7 w-7 text-cyan-300 transition-transform duration-300 group-hover:scale-110" /><h3 className="mt-7 text-xl font-semibold text-white">{title}</h3><p className="mt-3 text-[14px] leading-[1.75] text-white/60">{body}</p></article></ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="home-final-cta relative isolate overflow-hidden text-white">
        <div aria-hidden className="bg-aurora" /><div aria-hidden className="bg-noise" /><div aria-hidden className="home-cta-ring" />
        <CurveAccents className="absolute -right-48 -top-48" tone="light" size={850} opacity={0.16} />
        <ScrollReveal className="relative container-app py-28 text-center lg:py-40" y={28}>
          <h2 className="mx-auto max-w-4xl text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] text-balance sm:text-[58px] lg:text-[68px]">Stop Guessing. Start Scaling.</h2>
          <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-[1.75] text-white/68 sm:text-[18px]">Let ex-Google experts find your perfect partner match while you focus on your business. 100% free for customers, fully funded by the partner ecosystem.</p>
          <Button asChild variant="pill-magenta" size="xl" className="home-primary-cta mt-10 px-9"><Link href="/auth/sign-up">Get Started Now<ArrowRight className="h-4 w-4 transition-transform duration-240 group-hover/btn:translate-x-1" /></Link></Button>
        </ScrollReveal>
      </section>

    </div>
  );
}
