"use client";

/**
 * Sandbox launcher CTA.
 *
 * Client component: clicking the button calls the sandbox seed route
 * and, on 201, hard-navigates to the demo brief. We use a hard
 * navigation (not `router.push`) because the seed sets an HttpOnly
 * cookie and a fresh request is the cleanest way to pick it up.
 */

import * as React from "react";

export function SandboxLauncher() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sandbox/seed", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const reason =
          body?.error?.reason ?? body?.error?.code ?? `http-${res.status}`;
        setError(reason === "RATE_LIMITED" ? "Too many tries. Wait a minute and retry." : "Couldn't start the demo. Try again in a moment.");
        return;
      }
      const body = (await res.json()) as { session: { briefId: string } };
      window.location.assign(`/briefs/${body.session.briefId}`);
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={launch}
        disabled={busy}
        className="rounded-2xl bg-slate-950 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Spinning up demo…" : "Start the sandbox →"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">
        60-minute session. No credit card. No signup.
      </p>
    </div>
  );
}
