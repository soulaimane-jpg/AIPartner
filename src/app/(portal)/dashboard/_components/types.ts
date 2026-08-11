import type { BriefStage, BriefStatus, ServiceCategory } from "@/lib/enums";

/**
 * Plain serializable shape of a brief used by the workspace UI. Keeping
 * this narrow keeps the RSC → client boundary small and explicit.
 */
export type WorkspaceBrief = {
  id: string;
  title: string;
  stage: BriefStage;
  status: BriefStatus;
  completion: number;
  proposalsCount: number;
  matchesCount: number;
  hasActionRequired: boolean;
  services: ServiceCategory[];
  targetGoLive: string | null;
  budgetRange: string | null;
  updatedAt: string; // ISO
  createdAt: string; // ISO
};

export type UpcomingMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  meetLink: string | null;
};

export type WorkspaceView = "board" | "list" | "calendar";
