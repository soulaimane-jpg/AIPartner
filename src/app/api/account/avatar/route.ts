import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { openDownloadStream } from "@/lib/storage/gcs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const user = await queryOne<{ image: string | null }>(
    'SELECT "image" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  if (!user?.image?.startsWith("gcs:")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const storagePath = user.image.slice(4);
  const extension = storagePath.split(".").pop()?.toLowerCase() ?? "";

  try {
    const stream = openDownloadStream(storagePath);
    stream.on("error", (error) => {
      console.error("[account-avatar] stream failed", error);
      (stream as unknown as Readable).destroy();
    });
    const body = Readable.toWeb(stream as unknown as Readable) as unknown as ReadableStream;
    return new NextResponse(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "image/jpeg",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[account-avatar] download failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
