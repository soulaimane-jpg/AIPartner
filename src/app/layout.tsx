import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Fraunces } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { readConsent, POLICY_VERSION } from "@/lib/cookie-consent";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

// Geist kept for back-compat with any call-sites still referencing
// var(--font-geist-sans); Inter is the primary UI font.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Partner — Cloud presales, accelerated",
  description:
    "AI Partner matches customers with the best-fit Google Cloud partners — from scoping to signed SoW.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // We compute the banner visibility server-side so the page doesn't
  // hydrate with the banner flashing on for a frame.
  const consent = await readConsent();
  const bannerInitiallyOpen = !consent;
  // ePrivacy/GDPR: analytics may only load after an explicit opt-in, so this
  // is resolved from the consent cookie here rather than client-side.
  const analyticsAllowed = !!consent?.analytics;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <PostHogProvider analyticsAllowed={analyticsAllowed}>
            <MotionProvider>{children}</MotionProvider>
          </PostHogProvider>
        </ThemeProvider>
        <CookieBanner
          initialOpen={bannerInitiallyOpen}
          policyVersion={POLICY_VERSION}
          initialAnalytics={analyticsAllowed}
          initialMarketing={!!consent?.marketing}
        />
      </body>
    </html>
  );
}
