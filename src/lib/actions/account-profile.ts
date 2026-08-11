"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { queryOne, updateRows } from "@/lib/db";
import { deleteObject, StorageNotConfiguredError, uploadBuffer } from "@/lib/storage/gcs";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  jobTitle: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
});

const AVATAR_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AccountProfileResult =
  | { ok: true; imageUrl?: string | null }
  | { ok: false; error: string };

export async function updateAccountProfileAction(raw: unknown): Promise<AccountProfileResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  await updateRows("User", { id: session.user.id }, {
    name: parsed.data.name,
    jobTitle: parsed.data.jobTitle || null,
    location: parsed.data.location || null,
  });
  revalidateAccount();
  return { ok: true };
}

export async function uploadAccountAvatarAction(formData: FormData): Promise<AccountProfileResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  const extension = AVATAR_TYPES[file.type as keyof typeof AVATAR_TYPES];
  if (!extension) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  if (file.size > 1024 * 1024) return { ok: false, error: "Photo must be smaller than 1 MB." };

  const current = await queryOne<{ image: string | null }>(
    'SELECT "image" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  const storagePath = `avatars/${session.user.id}/${randomUUID()}.${extension}`;

  try {
    await uploadBuffer({
      storagePath,
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      filename: `profile.${extension}`,
    });
    await updateRows("User", { id: session.user.id }, { image: `gcs:${storagePath}` });
    if (current?.image?.startsWith("gcs:")) await deleteObject(current.image.slice(4));
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return { ok: false, error: "Profile photo uploads are not configured yet." };
    }
    return { ok: false, error: "Could not upload your photo. Please try again." };
  }

  revalidateAccount();
  return { ok: true, imageUrl: `/api/account/avatar?v=${Date.now()}` };
}

export async function removeAccountAvatarAction(): Promise<AccountProfileResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const current = await queryOne<{ image: string | null }>(
    'SELECT "image" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  await updateRows("User", { id: session.user.id }, { image: null });
  if (current?.image?.startsWith("gcs:")) await deleteObject(current.image.slice(4));
  revalidateAccount();
  return { ok: true, imageUrl: null };
}

function revalidateAccount() {
  revalidatePath("/profile");
  revalidatePath("/account");
  revalidatePath("/dashboard");
}
