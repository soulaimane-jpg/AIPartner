"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-wide theme provider.
 * - Auto (OS) by default, with manual override persisted in localStorage.
 * - Uses the `data-theme` HTML attribute so our CSS scopes
 *   `[data-theme="light"]` / `[data-theme="dark"]` apply deterministically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="mistio-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
