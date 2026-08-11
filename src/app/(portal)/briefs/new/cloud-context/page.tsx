import Link from "next/link";
import { redirect } from "next/navigation";
import { CloudCog, LockKeyhole } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCloudContextAction, skipCloudContextAction } from "@/lib/actions/cloud-context";

const providers = [
  ["gcp", "Google Cloud (GCP)"],
  ["aws", "Amazon Web Services (AWS)"],
  ["azure", "Microsoft Azure"],
  ["other", "On-Premise / Other"],
] as const;
const spendOptions = [
  ["below_5k", "Below $5k / month"], ["5k_30k", "$5k – $30k / month"],
  ["30k_50k", "$30k – $50k / month"], ["50k_100k", "$50k – $100k / month"],
  ["100k_500k", "$100k – $500k / month"], ["above_500k", "Above $500k / month"],
  ["prefer_not_to_share", "I prefer not to share / I don't know"],
] as const;

export default async function CloudContextPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");
  return (
    <div className="page-container max-w-3xl py-8">
      <header className="mb-6 flex items-start gap-3">
        <span className="portal-icon-box bg-primary/10 text-primary"><CloudCog className="h-5 w-5" /></span>
        <div><div className="eyebrow text-primary">Company cloud context</div><h1 className="portal-page-title">Help Us Optimize Your Deal</h1><p className="portal-page-description">To secure the most aggressive discounts, unique Google funding, and matching technical expertise, we need a baseline understanding of your current cloud footprint.</p></div>
      </header>
      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-relaxed text-foreground">Our experience shows that having these metrics ready saves weeks of back-and-forth negotiation and directly impacts the commercial terms partners can unlock for you.</div>
      <form action={saveCloudContextAction} className="space-y-7 rounded-2xl border border-border bg-card p-5 shadow-elev-1 sm:p-7">
        <section className="space-y-3"><h2 className="font-semibold">Which cloud providers do you use, and what is your approximate monthly spend?</h2><p className="text-[12px] text-muted-foreground">Why we ask: Knowing your footprint gives us leverage to negotiate deeper consolidated discounts.</p><div className="grid gap-3 sm:grid-cols-2">{providers.map(([key,label]) => <label key={key} className="rounded-lg border border-border p-3"><span className="flex items-center gap-2 font-medium"><input type="checkbox" name={`provider_${key}`} />{label}</span><select name={`spend_${key}`} className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2 text-[12px]" defaultValue="prefer_not_to_share">{spendOptions.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div></section>
        <section className="space-y-3"><h2 className="font-semibold">Are you currently procuring Google Cloud through a Google Resell Partner?</h2><RadioGroup name="resellerStatus" /><Input name="resellerWebsite" placeholder="e.g., partnerwebsite.com" aria-label="Partner website" /></section>
        <section className="space-y-3"><h2 className="font-semibold">Do you have an Enterprise Agreement directly in place with Google?</h2><RadioGroup name="agreementStatus" /><div className="grid gap-3 sm:grid-cols-2"><label className="text-[12px]">Contract start date<Input className="mt-1" type="month" name="agreementStartDate" /></label><label className="text-[12px]">Contract end date<Input className="mt-1" type="month" name="agreementEndDate" /></label><label className="text-[12px]">Minimum commitment (USD)<Input className="mt-1" type="number" min="0" name="minimumCommitmentUsd" /></label><label className="text-[12px]">Discount percentage<Input className="mt-1" type="number" min="0" max="100" step="0.1" name="discountPct" /></label></div></section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Stored once for your company and editable later.</span><div className="flex gap-2"><Button formAction={skipCloudContextAction} formNoValidate variant="ghost">Skip for now</Button><Button type="submit">Save &amp; continue</Button></div></div>
      </form>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">Takes less than 2 minutes · <Link href="/dashboard" className="underline">Return to workspace</Link></p>
    </div>
  );
}

function RadioGroup({ name }: { name: string }) {
  return <div className="flex flex-wrap gap-4 text-[13px]">{[["yes","Yes"],["no","No"],["unknown","I do not know / Not sure"]].map(([value,label]) => <label key={value} className="flex items-center gap-1.5"><input required type="radio" name={name} value={value} />{label}</label>)}</div>;
}
