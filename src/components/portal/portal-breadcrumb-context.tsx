"use client";

import { createContext, useContext, useEffect } from "react";

export type PortalCrumb = { label: string; href?: string };

const PortalBreadcrumbContext = createContext<
  ((crumbs: PortalCrumb[] | null) => void) | null
>(null);

export function PortalBreadcrumbProvider({
  setCrumbs,
  children,
}: {
  setCrumbs: (crumbs: PortalCrumb[] | null) => void;
  children: React.ReactNode;
}) {
  return (
    <PortalBreadcrumbContext.Provider value={setCrumbs}>
      {children}
    </PortalBreadcrumbContext.Provider>
  );
}

export function PortalBreadcrumbs({ crumbs }: { crumbs: PortalCrumb[] }) {
  const setCrumbs = useContext(PortalBreadcrumbContext);

  useEffect(() => {
    setCrumbs?.(crumbs);
    return () => setCrumbs?.(null);
  }, [crumbs, setCrumbs]);

  return null;
}
