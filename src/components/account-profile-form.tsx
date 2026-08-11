"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  ExternalLink,
  LockKeyhole,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeAccountAvatarAction,
  updateAccountProfileAction,
  uploadAccountAvatarAction,
} from "@/lib/actions/account-profile";

export type AccountProfileData = {
  name: string;
  email: string;
  jobTitle: string;
  location: string;
  imageUrl: string | null;
  emailVerified: boolean;
  passwordEnabled: boolean;
  googleLinked: boolean;
  companyName: string;
};

export function AccountProfileForm({ initial }: { initial: AccountProfileData }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [location, setLocation] = useState(initial.location);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [saving, startSaving] = useTransition();
  const [uploading, startUploading] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const result = await updateAccountProfileAction({ name, jobTitle, location });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      toast.success("Profile details updated");
    });
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImageUrl(preview);
    startUploading(async () => {
      const formData = new FormData();
      formData.set("avatar", file);
      const result = await uploadAccountAvatarAction(formData);
      URL.revokeObjectURL(preview);
      if (!result.ok) {
        setImageUrl(initial.imageUrl);
        toast.error(result.error);
        return;
      }
      setImageUrl(result.imageUrl ?? null);
      router.refresh();
      toast.success("Profile photo updated");
    });
  }

  function removePhoto() {
    startUploading(async () => {
      const result = await removeAccountAvatarAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setImageUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      toast.success("Profile photo removed");
    });
  }

  return (
    <div className="space-y-5">
      <section className="customer-panel overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_90%_0%,hsl(var(--primary)/0.14),transparent_28rem),linear-gradient(135deg,hsl(var(--surface-2)),hsl(var(--card))_65%)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <Avatar
                name={name || initial.email}
                src={imageUrl}
                className="h-24 w-24 text-[24px] ring-4 ring-card shadow-elev-3"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-elev-2 transition-transform hover:scale-105 disabled:opacity-60"
                aria-label="Upload profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => upload(event.target.files?.[0])}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow text-primary">Account profile</div>
              <h2 className="mt-2 truncate text-[24px] font-semibold tracking-[-0.025em] text-foreground">
                {name || "Your profile"}
              </h2>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                {jobTitle || "Add your role"}{initial.companyName ? ` · ${initial.companyName}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
                  <Camera className="h-3.5 w-3.5" /> Change photo
                </Button>
                {imageUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={removePhoto} disabled={uploading}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">JPG, PNG or WebP · maximum 1 MB</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <form onSubmit={save} className="customer-panel overflow-hidden">
          <header className="customer-panel-header">
            <div className="flex items-center gap-3">
              <IconTile size="sm" tone="indigo"><UserRound /></IconTile>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Personal information</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Keep your customer workspace identity current.</p>
              </div>
            </div>
          </header>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field label="Full name" icon={<UserRound />}>
              <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={100} />
            </Field>
            <Field label="Work email" icon={<Mail />}>
              <div className="relative">
                <Input value={initial.email} readOnly className="pr-9 text-muted-foreground" />
                {initial.emailVerified && <BadgeCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" aria-label="Verified email" />}
              </div>
            </Field>
            <Field label="Job title" icon={<BriefcaseBusiness />}>
              <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} autoComplete="organization-title" placeholder="e.g. Head of Cloud" maxLength={120} />
            </Field>
            <Field label="Location" icon={<MapPin />}>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} autoComplete="address-level2" placeholder="City, country" maxLength={120} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-border bg-secondary/25 px-5 py-3.5 sm:px-6">
            <Button type="submit" size="sm" loading={saving}>
              <Save className="h-3.5 w-3.5" /> Save changes
            </Button>
          </div>
        </form>

        <section className="customer-panel overflow-hidden">
          <header className="customer-panel-header">
            <div className="flex items-center gap-3">
              <IconTile size="sm" tone="indigo"><ShieldCheck /></IconTile>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Sign-in & security</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Manage how you access your account.</p>
              </div>
            </div>
          </header>
          <div className="space-y-4 p-5 sm:p-6">
            <SecurityRow
              icon={<Mail />}
              label="Email"
              value={initial.emailVerified ? "Verified" : "Verification pending"}
              tone={initial.emailVerified ? "success" : "muted"}
            />
            <SecurityRow
              icon={<LockKeyhole />}
              label="Password"
              value={initial.passwordEnabled ? "Password enabled" : "Managed by Google"}
            />
            {initial.googleLinked && (
              <SecurityRow icon={<BadgeCheck />} label="Google account" value="Connected" tone="success" />
            )}
            <div className="space-y-2 border-t border-border pt-4">
              {initial.passwordEnabled && (
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link href={`/auth/reset?email=${encodeURIComponent(initial.email)}`}>
                    Update password <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="w-full justify-between">
                <Link href="/account/security">
                  Advanced security <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-muted-foreground">
        {icon}{label}
      </Label>
      {children}
    </div>
  );
}

function SecurityRow({
  icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "muted" | "success";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={tone === "success" ? "text-[12.5px] font-semibold text-success" : "text-[12.5px] font-semibold text-foreground"}>{value}</div>
      </div>
    </div>
  );
}
