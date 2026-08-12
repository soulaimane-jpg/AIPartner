/**
 * Role‑aware navigation config used by the portal chrome.
 *
 * Items are serialized as plain data so they can cross the RSC/client
 * boundary safely. Icons are referenced by string keys that the client
 * `<PortalRail />` resolves into lucide components.
 */

export type RailIconKey =
  | "workspace"
  | "briefs"
  | "proposals"
  | "activity"
  | "templates"
  | "pipeline"
  | "leads"
  | "insights"
  | "refer"
  | "inbox"
  | "won"
  | "profile"
  | "matches"
  | "partners"
  | "users"
  | "googlers"
  | "flags"
  | "developers"
  | "sub-processors"
  | "audit"
  | "meetings"
  | "settings"
  | "help";

export type RailItem = {
  href: string;
  label: string;
  icon: RailIconKey;
  /** Optional ⌘-shortcut hint */
  hint?: string;
  /** When true, item triggers a portal action (handled in client) instead of navigating */
  action?: "command-palette" | "refer-customer";
  /** Optional badge count, shown to the right of the label */
  badgeKey?: "inbox-unread" | "decisions-due";
};

export type PortalRole =
  | "CUSTOMER"
  | "GOOGLER"
  | "PARTNER"
  | "ADMIN"
  | "COLLABORATOR";

export type PortalNav = {
  primary: RailItem[];
  /** Items rendered in the bottom cluster (settings / help / etc.) */
  footer: RailItem[];
};

export function getPortalNav(role: PortalRole | string | undefined): PortalNav {
  switch (role) {
    case "CUSTOMER":
      return {
        primary: [
          { href: "/dashboard", label: "Dashboard", icon: "workspace", badgeKey: "decisions-due" },
          { href: "/briefs",    label: "Briefs",    icon: "briefs" },
          { href: "/templates", label: "Templates", icon: "templates" },
          { href: "/calls",     label: "Calls",     icon: "meetings"  },
        ],
        footer: [
          { href: "/settings/company", label: "Company profile", icon: "settings" },
          { href: "/settings/members", label: "Members", icon: "users" },
          { href: "/account", label: "Account", icon: "profile" },
        ],
      };
    case "GOOGLER":
      return {
        primary: [
          { href: "/google",         label: "Pipeline", icon: "pipeline" },
          { href: "/google/leads",   label: "Leads",    icon: "leads"    },
          { href: "/google/insights", label: "Insights", icon: "insights" },
        ],
        footer: [
          { href: "/google/leads/new", label: "Refer customer", icon: "refer", hint: "⌘N", action: "refer-customer" },
        ],
      };
    case "PARTNER":
      return {
        primary: [
          { href: "/partner", label: "Overview", icon: "workspace" },
          { href: "/partner/opportunities", label: "Opportunities", icon: "inbox", badgeKey: "inbox-unread" },
          { href: "/partner/pipeline", label: "Pipeline", icon: "pipeline" },
          { href: "/partner/won", label: "Won", icon: "won" },
          { href: "/partner/analytics", label: "Analytics", icon: "insights" },
        ],
        footer: [
          { href: "/partner/profile", label: "Company profile", icon: "profile" },
        ],
      };
    case "ADMIN":
      return {
        primary: [
          { href: "/admin",                      label: "Overview",       icon: "workspace" },
          { href: "/admin/briefs",               label: "Briefs",         icon: "briefs"    },
          { href: "/admin/partners",             label: "Partners",       icon: "partners"  },
          { href: "/admin/partners/performance", label: "Partner ops",    icon: "insights"  },
          { href: "/admin/tags",                 label: "Tag library",    icon: "flags"     },
          { href: "/admin/users",                label: "Users",          icon: "users"     },
          { href: "/admin/googlers",             label: "Googlers",       icon: "googlers"  },
          { href: "/admin/matches",              label: "Matches",        icon: "matches"   },
          { href: "/admin/anonymization",        label: "Anonymization",  icon: "flags"     },
          { href: "/admin/meetings",             label: "Meetings",       icon: "meetings"  },
          { href: "/admin/legal",                label: "Legal docs",     icon: "sub-processors" },
          { href: "/admin/notifications",        label: "Notifications",  icon: "inbox"     },
          { href: "/admin/flags",                label: "Flags",          icon: "flags"     },
          { href: "/admin/developers",           label: "Developers",     icon: "developers" },
          { href: "/admin/sub-processors",       label: "Sub-processors", icon: "sub-processors" },
          { href: "/admin/audit",                label: "Audit log",      icon: "audit"     },
        ],
        footer: [
          { href: "/admin/settings",  label: "Settings", icon: "settings" },
        ],
      };
    case "COLLABORATOR":
      return {
        primary: [
          { href: "/collaborations", label: "Collaborations", icon: "briefs" },
        ],
        footer: [
          { href: "/account", label: "Settings", icon: "settings" },
        ],
      };
    default:
      return { primary: [], footer: [] };
  }
}
