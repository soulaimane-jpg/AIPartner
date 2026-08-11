"use client";

import { useState, useTransition } from "react";
import { Building2, Cloud, Plus, Save, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GCP_SPECIALIZATIONS, PARTNER_TIERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  updatePartnerProfileAction,
  inviteTeammateAction,
} from "@/lib/actions/partner";
import { PartnerImportCard, type Extracted } from "@/components/partner-import-card";

type Initial = {
  name: string;
  tagline: string;
  description: string;
  website: string;
  headquarters: string;
  teamSize: string;
  industry: string;
  languages: string[];
  regions: string[];
  tier: "MEMBER" | "PARTNER" | "PREMIER";
  specializations: string[];
  expertiseAreas: string[];
  awards: { title: string; year: number; issuer?: string }[];
  directoryUrl: string;
  // Rich strengths
  caseStudies: {
    title: string;
    client: string;
    industry: string;
    summary: string;
    outcome: string;
    link: string;
  }[];
  keyClients: string[];
  industryExperience: string[];
  certifications: { name: string; count: number; level: string }[];
  differentiators: string[];
  officeLocations: string[];
  serviceModels: string[];
  gcpTier: string;
  partnerSince: string;
};

export function PartnerProfileForm({
  initial,
  teamMembers,
}: {
  initial: Initial;
  teamMembers: { id: string; name: string | null; email: string }[];
}) {
  const [state, setState] = useState<Initial>(initial);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<Initial>) => setState((s) => ({ ...s, ...patch }));

  const toggle = (key: "specializations", value: string) => {
    setState((s) => {
      const cur = new Set(s[key]);
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      return { ...s, [key]: Array.from(cur) };
    });
  };

  const save = () => {
    startTransition(async () => {
      const result = await updatePartnerProfileAction(state);
      if (result.ok) {
        toast.success("Company profile saved");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not save the company profile",
        );
      }
    });
  };

  const applyImport = (patch: Extracted, sourceUrl: string) => {
    const canonicalSet = new Set(
      GCP_SPECIALIZATIONS.map((s) => s.toLowerCase()),
    );
    const matched: string[] = [];
    const extra: string[] = [];
    for (const raw of patch.specializations ?? []) {
      const hit = GCP_SPECIALIZATIONS.find(
        (c) => c.toLowerCase() === raw.toLowerCase(),
      );
      if (hit) matched.push(hit);
      else if (canonicalSet.has(raw.toLowerCase())) matched.push(raw);
      else extra.push(raw);
    }
    update({
      name: patch.name || state.name,
      tagline: patch.tagline ?? state.tagline,
      description: patch.description ?? state.description,
      website: patch.website || state.website,
      headquarters: patch.headquarters || state.headquarters,
      teamSize: patch.teamSize || state.teamSize,
      industry: patch.industry || state.industry,
      tier: mapImportedPartnerTier(patch.gcpTier) ?? state.tier,
      gcpTier: patch.gcpTier || state.gcpTier,
      partnerSince: patch.partnerSince || state.partnerSince,
      languages: mergeArr(state.languages, patch.languages),
      regions: mergeArr(state.regions, patch.regions),
      officeLocations: mergeArr(state.officeLocations, patch.officeLocations),
      serviceModels: mergeArr(state.serviceModels, patch.serviceModels),
      specializations: mergeArr(state.specializations, matched),
      expertiseAreas: mergeArr(state.expertiseAreas, [
        ...(patch.expertiseAreas ?? []),
        ...extra,
      ]),
      industryExperience: mergeArr(
        state.industryExperience,
        patch.industryExperience,
      ),
      keyClients: mergeArr(state.keyClients, patch.keyClients),
      differentiators: mergeArr(state.differentiators, patch.differentiators),
      // The importer returns partial records (it can only report what the page
      // actually stated), so fill the gaps here rather than letting undefined
      // reach fields the editor renders as strings.
      certifications: [
        ...state.certifications,
        ...(patch.certifications ?? [])
          .filter(
            (c) =>
              c?.name &&
              !state.certifications.some(
                (x) => x.name.toLowerCase() === String(c.name).toLowerCase(),
              ),
          )
          .map((c) => ({
            name: c.name,
            count: c.count ?? 0,
            level: c.level ?? "",
          })),
      ],
      caseStudies: [
        ...state.caseStudies,
        ...(patch.caseStudies ?? [])
          .filter(
            (cs) =>
              cs?.title && !state.caseStudies.some((x) => x.title === cs.title),
          )
          .map((cs) => ({
            title: cs.title,
            client: cs.client ?? "",
            industry: cs.industry ?? "",
            summary: cs.summary ?? "",
            outcome: cs.outcome ?? "",
            link: cs.link ?? "",
          })),
      ],
      awards: [
        ...state.awards,
        ...(patch.awards?.filter(
          (a) => a.title && !state.awards.some((x) => x.title === a.title),
        ) ?? []),
      ],
      directoryUrl: sourceUrl,
    });
  };

  return (
    <div className="space-y-8">
      {/* Import fills fields across every tab, so it sits above the tab bar
          rather than between the tabs and their panels. */}
      <PartnerImportCard
        initialUrl={state.directoryUrl}
        onApply={applyImport}
      />

      <Tabs defaultValue="company" className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
          {/* The active trigger renders on a white `bg-card` pill, so the list
              itself must stay tinted — a white list made the selected tab
              invisible and the tabs looked broken. */}
          <TabsList className="h-11 w-full justify-start overflow-x-auto rounded-xl border border-line p-1 sm:w-auto">
            <TabsTrigger value="company" className="rounded-lg text-xs font-semibold">
              <Building2 className="mr-2 h-3.5 w-3.5" /> Company
            </TabsTrigger>
            <TabsTrigger value="gcloud" className="rounded-lg text-xs font-semibold">
              <Cloud className="mr-2 h-3.5 w-3.5" /> Capabilities
            </TabsTrigger>
            <TabsTrigger value="team" className="rounded-lg text-xs font-semibold">
              <Users className="mr-2 h-3.5 w-3.5" /> Team
            </TabsTrigger>
          </TabsList>
          <Button onClick={save} disabled={pending} className="h-11 px-6 font-semibold shadow-sm">
            <Save className="mr-2 h-4 w-4" /> {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>

      <TabsContent value="company" className="mt-0 space-y-8 animate-fade-in">
        <Card className="border-line bg-card shadow-elev-1">
          <CardContent className="space-y-8 p-5 sm:p-7 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-[2px] bg-indigo-500"></div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Company details</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <Field label="Company name">
                <Input
                  value={state.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
                />
              </Field>
              <Field label="Tagline">
                <Input
                  value={state.tagline}
                  onChange={(e) => update({ tagline: e.target.value })}
                  placeholder="Trusted GCP partner for data platforms"
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
                />
              </Field>
              <Field label="Company overview" className="md:col-span-2">
                <Textarea
                  rows={4}
                  value={state.description}
                  onChange={(e) => update({ description: e.target.value })}
                  className="bg-white border-slate-200 text-slate-900 rounded-2xl min-h-[120px]"
                />
              </Field>
              <Field label="Company Website">
                <Input
                  value={state.website}
                  onChange={(e) => update({ website: e.target.value })}
                  placeholder="https://yourcompany.com"
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
                />
              </Field>
              <Field label="Headquarters">
                <Input
                  value={state.headquarters}
                  onChange={(e) => update({ headquarters: e.target.value })}
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
                />
              </Field>
              <Field label="Team size">
                <Input
                  value={state.teamSize}
                  onChange={(e) => update({ teamSize: e.target.value })}
                  placeholder="e.g., 50–200"
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12 font-mono"
                />
              </Field>
              <Field label="Primary industry">
                <Input
                  value={state.industry}
                  onChange={(e) => update({ industry: e.target.value })}
                  className="bg-white border-slate-200 text-slate-900 rounded-xl h-12"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line bg-card shadow-elev-1">
          <CardContent className="space-y-8 p-5 sm:p-7 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-[2px] bg-cyan-500"></div>
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Awards and recognition</h2>
              </div>
            </div>
            <div className="space-y-4">
              {state.awards.map((a, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-200 group transition-all hover:border-slate-200">
                  <Input
                    placeholder="Award title"
                    value={a.title}
                    onChange={(e) =>
                      update({
                        awards: state.awards.map((x, idx) =>
                          idx === i ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                    className="bg-transparent border-0 focus-visible:ring-0 h-8 text-sm font-bold flex-1"
                  />
                  <div className="hidden sm:block h-8 w-[1px] bg-white"></div>
                  <Input
                    placeholder="Issuer"
                    value={a.issuer ?? ""}
                    onChange={(e) =>
                      update({
                        awards: state.awards.map((x, idx) =>
                          idx === i ? { ...x, issuer: e.target.value } : x,
                        ),
                      })
                    }
                    className="bg-transparent border-0 focus-visible:ring-0 h-8 text-sm w-full sm:w-48 text-slate-500"
                  />
                  <div className="hidden sm:block h-8 w-[1px] bg-white"></div>
                  <Input
                    type="number"
                    placeholder="Year"
                    value={a.year}
                    onChange={(e) =>
                      update({
                        awards: state.awards.map((x, idx) =>
                          idx === i ? { ...x, year: Number(e.target.value) } : x,
                        ),
                      })
                    }
                    className="bg-transparent border-0 focus-visible:ring-0 h-8 text-sm w-full sm:w-24 font-mono text-blue-600"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update({
                        awards: state.awards.filter((_, idx) => idx !== i),
                      })
                    }
                    className="h-8 w-8 text-slate-700 hover:text-red-500 hover:bg-red-500/10 self-center"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {state.awards.length === 0 && (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl text-xs font-mono text-slate-700 ">
                  No awards added yet.
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                update({
                  awards: [
                    ...state.awards,
                    { title: "", year: new Date().getFullYear() },
                  ],
                })
              }
              className="h-10 border-line bg-card px-5 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Plus className="h-4 w-4 mr-2" /> Add award
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="gcloud" className="mt-0 space-y-8 animate-fade-in">

        <Card className="border-line bg-card shadow-elev-1">
          <CardContent className="space-y-10 p-5 sm:p-7 lg:p-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-[2px] bg-indigo-500"></div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Partner tier</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PARTNER_TIERS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() =>
                      update({ tier: t.key as Initial["tier"] })
                    }
                    className={cn(
                      "group flex flex-col items-center gap-3 rounded-xl border p-6 transition-colors",
                      state.tier === t.key
                        ? "border-primary bg-primary-soft shadow-elev-1"
                        : "border-line bg-card hover:border-line-strong hover:bg-secondary/50"
                    )}
                  >
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full transition-transform",
                      state.tier === t.key ? "scale-110 bg-primary" : "bg-slate-300"
                    )} />
                    <div className={cn(
                      "text-xs font-semibold transition-colors",
                      state.tier === t.key ? "text-primary" : "text-muted-foreground"
                    )}>
                      {t.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-[2px] bg-cyan-500"></div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Google Cloud specializations</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {GCP_SPECIALIZATIONS.map((s) => {
                  const active = state.specializations.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle("specializations", s)}
                      className={cn(
                        "rounded-xl border p-4 text-center text-xs font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary-soft text-primary shadow-elev-1"
                          : "border-line bg-card text-muted-foreground hover:border-line-strong hover:bg-secondary/50 hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3">
                <div className="h-8 w-[2px] bg-indigo-400"></div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Products and expertise</h2>
              </div>
              <TagInput
                values={state.expertiseAreas}
                onChange={(v) => update({ expertiseAreas: v })}
                placeholder="BigQuery, Looker, Vertex AI…"
              />
              <p className="text-xs text-muted-foreground">Add specific Google Cloud products and tools.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="team" className="mt-0 space-y-8 animate-fade-in">
        <Card className="border-line bg-card shadow-elev-1">
          <CardContent className="space-y-8 p-5 sm:p-7 lg:p-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-[2px] bg-indigo-500"></div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Team members</h2>
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Invite colleagues who should manage opportunities and proposals.
              </p>
            </div>
            
            <InviteRow />
            
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">Members</div>
              {teamMembers.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-slate-200 rounded-3xl text-xs font-mono text-slate-700 ">
                  No team members yet.
                </div>
              ) : (
                <div className="grid gap-4">
                  {teamMembers.map((m) => (
                    <div
                      key={m.id}
                      className="group flex flex-col gap-4 rounded-xl border border-line bg-surface-sunk p-5 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-5">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-card text-muted-foreground transition-colors group-hover:text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary">
                            {m.name ?? "Team member"}
                          </div>
                          <div className="text-xs font-mono text-slate-500 ">{m.email}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit rounded-full border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-semibold text-blue-700">
                        MEMBER
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}

function mapImportedPartnerTier(value: string | undefined): Initial["tier"] | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("premier")) return "PREMIER";
  if (normalized.includes("partner")) return "PARTNER";
  if (normalized.includes("member")) return "MEMBER";
  return undefined;
}

function mergeArr(existing: string[], incoming: string[] | undefined): string[] {
  const set = new Set(existing.map((s) => s.toLowerCase()));
  const out = [...existing];
  for (const v of incoming ?? []) {
    if (!v) continue;
    if (!set.has(v.toLowerCase())) {
      out.push(v);
      set.add(v.toLowerCase());
    }
  }
  return out;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"space-y-2 " + (className ?? "")}>
      <Label className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <Badge key={v} variant="outline" className="group gap-2 rounded-lg border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700 transition-colors hover:border-blue-200">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-slate-600 hover:text-red-600 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-12 bg-white border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-11 shrink-0 rounded-lg border-line bg-card px-5 text-xs font-semibold text-foreground hover:bg-secondary">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function InviteRow() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const invite = () => {
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await inviteTeammateAction({ email, name });
      if (result.ok) {
        toast.success("Team invitation sent");
        setEmail("");
        setName("");
      } else {
        toast.error(
          result.error.code === "CONFLICT" && "reason" in result.error
            ? result.error.reason
            : "Could not send the invitation",
        );
      }
    });
  };

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface-sunk p-5 sm:p-6">
      <div className="text-sm font-semibold text-foreground">Invite a team member</div>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="team-invite-email" className="text-xs font-semibold text-muted-foreground">Work email *</Label>
          <Input
            id="team-invite-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="colleague@company.com"
            className="h-11 bg-white border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="h-11 bg-white border-slate-200 text-slate-900 rounded-xl text-xs"
          />
        </div>
        <Button
          type="button"
          onClick={invite}
          disabled={pending || !email.trim()}
          aria-busy={pending || undefined}
          className="h-11 self-end rounded-lg px-6 font-semibold shadow-sm"
        >
          {pending ? "Sending..." : "Send invite"}
        </Button>
      </div>
    </div>
  );
}
