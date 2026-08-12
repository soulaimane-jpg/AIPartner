import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  FileText,
  TrendingUp,
  Shield,
  Headphones,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TEMPLATES, type Template } from "@/lib/templates";

export const metadata = { title: "Templates · AI Partner" };

const TEMPLATE_THEME: Record<
  Template["key"],
  {
    icon: LucideIcon;
    accent: string;
    badge: string;
    headerBg: string;
    iconBox: string;
    navHover: string;
    lightbulb: string;
    checkIcon: string;
  }
> = {
  RESELLING: {
    icon: TrendingUp,
    accent: "text-primary",
    badge: "border-primary/20 bg-primary/5 text-primary",
    headerBg: "bg-gradient-to-br from-primary/[0.08] to-card",
    iconBox: "bg-primary/10 text-primary ring-1 ring-primary/15",
    navHover: "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
    lightbulb: "text-primary",
    checkIcon: "text-primary",
  },
  CONSULTING: {
    icon: FileText,
    accent: "text-primary",
    badge: "border-primary/20 bg-primary/5 text-primary",
    headerBg: "bg-gradient-to-br from-primary/[0.08] to-card",
    iconBox: "bg-primary/10 text-primary ring-1 ring-primary/15",
    navHover: "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
    lightbulb: "text-primary",
    checkIcon: "text-primary",
  },
  MANAGED: {
    icon: Shield,
    accent: "text-primary",
    badge: "border-primary/20 bg-primary/5 text-primary",
    headerBg: "bg-gradient-to-br from-primary/[0.08] to-card",
    iconBox: "bg-primary/10 text-primary ring-1 ring-primary/15",
    navHover: "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
    lightbulb: "text-primary",
    checkIcon: "text-primary",
  },
  SUPPORT: {
    icon: Headphones,
    accent: "text-primary",
    badge: "border-primary/20 bg-primary/5 text-primary",
    headerBg: "bg-gradient-to-br from-primary/[0.08] to-card",
    iconBox: "bg-primary/10 text-primary ring-1 ring-primary/15",
    navHover: "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
    lightbulb: "text-primary",
    checkIcon: "text-primary",
  },
  TRAINING: {
    icon: GraduationCap,
    accent: "text-primary",
    badge: "border-primary/20 bg-primary/5 text-primary",
    headerBg: "bg-gradient-to-br from-primary/[0.08] to-card",
    iconBox: "bg-primary/10 text-primary ring-1 ring-primary/15",
    navHover: "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
    lightbulb: "text-primary",
    checkIcon: "text-primary",
  },
};

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/templates");

  return (
    <div className="page-container portal-page max-w-6xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <BookOpen className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow">Scoping library</div>
            <h1 className="portal-page-title">Templates</h1>
            <p className="portal-page-description">
              Each engagement type follows a different proposal shape. Use these
              templates to understand what information to provide, what good
              answers look like, and why each piece matters when partners price
              their work.
            </p>
          </div>
        </div>
        <Button asChild size="default" className="w-full sm:w-auto">
          <Link href="/briefs/new">
            <Plus className="h-3.5 w-3.5" />
            New brief
          </Link>
        </Button>
      </header>

      {/* Quick-nav pills */}
      <nav aria-label="Template list" className="flex flex-wrap gap-2.5 pb-8">
        {TEMPLATES.map((t) => {
          const theme = TEMPLATE_THEME[t.key];
          const Icon = theme.icon;
          return (
            <a
              key={t.key}
              href={`#${t.key.toLowerCase()}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground shadow-elev-1 transition-colors ${theme.navHover}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.title.split(" — ")[0]}
            </a>
          );
        })}
      </nav>

      {/* Template cards */}
      <div className="space-y-10">
        {TEMPLATES.map((t) => {
          const theme = TEMPLATE_THEME[t.key];
          const Icon = theme.icon;
          return (
            <section
              key={t.key}
              id={t.key.toLowerCase()}
              className="customer-panel scroll-mt-24 overflow-hidden"
            >
              {/* Colored header */}
              <header className={`flex flex-wrap items-start justify-between gap-4 border-b border-border px-7 py-7 sm:px-8 ${theme.headerBg}`}>
                <div className="flex items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${theme.iconBox}`} aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${theme.badge}`}>
                      {t.category}
                    </span>
                    <h2 className="mt-2.5 text-[19px] font-semibold tracking-[-0.01em] text-foreground">
                      {t.title}
                    </h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground max-w-2xl">
                      {t.description}
                    </p>
                  </div>
                </div>
              </header>

              {/* Proposal format */}
              <div className="space-y-3.5 px-7 py-6 sm:px-8">
                <h3 className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${theme.checkIcon}`} />
                  Proposal format
                </h3>
                <ul className="text-[13px] text-foreground space-y-2.5 list-disc pl-5 marker:text-muted-foreground/60">
                  {t.proposalFormat.map((line, i) => (
                    <li key={i} className="leading-relaxed">{line}</li>
                  ))}
                </ul>
              </div>

              {/* Inputs table */}
              <div className="border-t border-border">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-[13px]">
                    <thead className="bg-secondary/30 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <tr className="text-left">
                        <th className="px-7 py-3.5 font-semibold w-[26%]">Input</th>
                        <th className="px-7 py-3.5 font-semibold w-[36%]">Good answer looks like</th>
                        <th className="px-7 py-3.5 font-semibold">Why it matters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {t.inputs.map((row) => (
                        <tr key={row.label} className="align-top transition-colors hover:bg-secondary/20">
                          <td className="px-7 py-4 font-medium text-foreground">
                            {row.label}
                          </td>
                          <td className="px-7 py-4 text-muted-foreground italic leading-relaxed">
                            &ldquo;{row.example}&rdquo;
                          </td>
                          <td className="px-7 py-4 text-muted-foreground leading-relaxed">
                            {row.rationale}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-border md:hidden">
                  {t.inputs.map((row) => (
                    <article key={row.label} className="space-y-3 px-7 py-5">
                      <h3 className="text-[14px] font-semibold text-foreground">{row.label}</h3>
                      <p className="text-[12.5px] italic leading-relaxed text-muted-foreground">
                        &ldquo;{row.example}&rdquo;
                      </p>
                      <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        <Lightbulb className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.lightbulb}`} />
                        {row.rationale}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
