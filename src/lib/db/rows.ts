/**
 * Row types for every table — generated from db/schema.sql by
 * scripts/gen-row-types.mjs. Regenerate after DDL changes.
 */

/* eslint-disable */

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  challengeAreas: string;
  passwordHash: string | null;
  role: string;
  jobTitle: string | null;
  location: string | null;
  companyId: string | null;
  googleId: string | null;
  image: string | null;
  emailVerified: Date | null;
  focusArea: string | null;
  surveyCompletedAt: Date | null;
  onboardedAt: Date | null;
  lastDigestAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadRow {
  id: string;
  googlerId: string;
  customerEmail: string;
  customerDomain: string;
  customerName: string | null;
  companyName: string | null;
  notes: string | null;
  inviteToken: string;
  status: string;
  invitedAt: Date;
  claimedAt: Date | null;
  claimedUserId: string | null;
  mockEmailBody: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyRow {
  id: string;
  name: string;
  kind: string;
  website: string | null;
  industry: string | null;
  /** PENDING | APPROVED | REJECTED — gates sourcing and invites. */
  verificationStatus: string;
  verifiedAt: Date | null;
  verifiedById: string | null;
  rejectionReason: string | null;
  domainVerifiedAt: Date | null;
  signupEmailDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMembershipRow {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  status: string;
  invitedById: string | null;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceInviteRow {
  id: string;
  companyId: string;
  email: string;
  role: string;
  tokenHash: string;
  status: string;
  expiresAt: Date;
  invitedById: string;
  acceptedById: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyCloudContextRow {
  id: string;
  companyId: string;
  providers: string;
  resellerStatus: string | null;
  resellerWebsite: string | null;
  agreementStatus: string | null;
  agreementStartDate: Date | null;
  agreementEndDate: Date | null;
  minimumCommitmentUsd: number | null;
  discountPct: number | null;
  gcpGreenfield: boolean;
  renewalWindow: boolean;
  completedAt: Date | null;
  skippedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerProfileRow {
  id: string;
  companyId: string;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  rawProfile: string;
  anonymizedProfile: string;
  lastExtractedAt: Date | null;
  updatedAt: Date;
  employeeCountBand: string | null;
  gcpAgreementStatus: string | null;
  gcpContractEndDate: Date | null;
  gcpDiscountPct: number | null;
  resellInterest: string | null;
  onboardingQuestionsState: string;
}

export interface PartnerProfileRow {
  id: string;
  companyId: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  headquarters: string | null;
  teamSize: string | null;
  industry: string | null;
  languages: string;
  regions: string;
  tier: string;
  specializations: string;
  expertiseAreas: string;
  awards: string;
  directoryUrl: string | null;
  logoUrl: string | null;
  caseStudies: string;
  keyClients: string;
  industryExperience: string;
  certifications: string;
  differentiators: string;
  officeLocations: string;
  serviceModels: string;
  gcpTier: string | null;
  partnerSince: string | null;
  leadRoutingEmail: string | null;
  acceptedTermsAt: Date | null;
  acceptedTermsBy: string | null;
  acceptedTermsName: string | null;
  clouds: string;
  sizeBand: string | null;
  tncStatus: string;
  tncVersion: number | null;
  source: string;
  // ── 5-pillar structured intake ──────────────────────────────
  /** JSON: [{name, category, description, access, impact, timeSaved}] */
  ipAssets: string;
  resellPlatforms: string | null;
  /** JSON: string[] of ENGAGEMENT_MODEL_OPTIONS values. */
  engagementModels: string;
  minDealSize: string | null;
  /** JSON: [lowMonths, highMonths] */
  typicalContractMonths: string | null;
  pocOffering: string | null;
  pocFixedFee: number | null;
  pocTurnaroundDays: number | null;
  benchAvailability: string | null;
  /** 0–100; percentage of the team that is senior/lead. */
  seniorityRatio: number | null;
  /** JSON: string[] of COLLABORATION_OPTIONS values. */
  collaborationStyles: string;
  /** JSON: {cloudSavingsPct?: [lo, hi], migrationMonths?: [lo, hi]} */
  valueRanges: string;
  referenceAvailability: string | null;
  lastVerifiedAt: Date | null;
  lastScrapedAt: Date | null;
  profileStrength: number;
  onboardingCompletedAt: Date | null;
  onboardingStep: string | null;
  updatedAt: Date;
}

export interface TagRow {
  id: string;
  slug: string;
  label: string;
  facet: string;
  pillar: string;
  /** global | pending | rejected */
  status: string;
  /** JSON: string[] of alternate spellings resolving to this tag. */
  synonyms: string;
  useCount: number;
  suggestedByCount: number;
  /** Set when this tag has been soft-merged into another. */
  mergedIntoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerTagRow {
  id: string;
  companyId: string;
  tagId: string;
  facet: string;
  createdAt: Date;
}

export interface ProfileChangeProposalRow {
  id: string;
  companyId: string;
  /** directory | website */
  source: string;
  sourceUrl: string | null;
  fieldKey: string;
  currentValue: string | null;
  proposedValue: string | null;
  /** pending | accepted | rejected | superseded */
  status: string;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectBriefRow {
  id: string;
  title: string;
  ownerId: string;
  companyId: string;
  stage: string;
  leadState: string;
  status: string;
  completion: number;
  services: string;
  source: string;
  intentRoute: string;
  deliveryModel: string;
  cloudContextSnapshot: string;
  procurement: string;
  usesCloud: boolean;
  hadPartner: boolean;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  meetingProposedSlots: string;
  meetingConfirmedAt: Date | null;
  meetingConfirmedBy: string | null;
  meetingAgenda: string | null;
  triagedAt: Date | null;
  triagedBy: string | null;
  triageNotes: string | null;
  origin: string;
  callRecordingRef: string | null;
  callTranscript: string | null;
  anonymizedCompanySummary: string | null;
  selectionDeadlineAt: Date | null;
  partnerPreferences: string;
  executiveSummary: string | null;
  scopeRequirements: string;
  dataSources: string;
  integrationPoints: string;
  successCriteria: string;
  customerRoles: string;
  targetGoLive: string | null;
  milestones: string;
  budgetRange: string | null;
  budgetNotes: string | null;
  preferredLocation: string | null;
  requiredCertifications: string;
  industryExperience: string;
  procurementType: string | null;
  decisionMakers: string;
  selectionCriteria: string;
  legalTimeline: string | null;
  reviewWorkflowConfirmed: boolean;
  requiresInternalReview: boolean;
  internalReviewerName: string | null;
  internalReviewerEmail: string | null;
  internalReviewerRole: string | null;
  requiresInternalApproval: boolean;
  internalApproverName: string | null;
  internalApproverEmail: string | null;
  internalApproverRole: string | null;
  reviewWorkflowNotes: string | null;
}

export interface BriefCollaboratorRow {
  id: string;
  briefId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  inviteToken: string;
  invitedById: string;
  userId: string | null;
  acceptedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  reviewNote: string | null;
  mockEmailBody: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefAccessRow {
  id: string;
  briefId: string;
  userId: string;
  role: string;
  status: string;
  grantedById: string;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefAccessRequestRow {
  id: string;
  briefId: string;
  requesterId: string;
  status: string;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageRow {
  id: string;
  briefId: string;
  userId: string | null;
  role: string;
  content: string;
  meta: string | null;
  createdAt: Date;
}

export interface MatchRow {
  id: string;
  briefId: string;
  partnerId: string;
  status: string;
  note: string | null;
  outreachToken: string | null;
  outreachEmail: string | null;
  outreachSentAt: Date | null;
  forwardedFromEmail: string | null;
  mockEmailBody: string | null;
  acceptedTermsAt: Date | null;
  acceptedTermsBy: string | null;
  acceptedTermsName: string | null;
  acceptedTermsIp: string | null;
  acceptedTermsUa: string | null;
  customerPriority: number | null;
  matchRationale: string | null;
  matchRationaleVer: string | null;
  matchScore: number | null;
  declineReason: string | null;
  declineNote: string | null;
  winLossReasons: string | null;
  acceptDeadlineAt: Date | null;
  proposalDeadlineAt: Date | null;
  extensionUsed: boolean;
  extensionRequestedAt: Date | null;
  extensionNote: string | null;
  extensionResolvedAt: Date | null;
  extensionGrantedBy: string | null;
  placeholderLabel: string | null;
  meetingProposedSlots: string | null;
  meetingAgenda: string | null;
  meetingConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalRow {
  id: string;
  briefId: string;
  partnerId: string;
  matchId: string;
  status: string;
  summary: string | null;
  approach: string | null;
  teamComposition: string;
  timelineWeeks: number | null;
  totalCost: number | null;
  costBreakdown: string;
  strengths: string;
  risks: string;
  docUrl: string | null;
  submittedAt: Date | null;
  internalApprovedById: string | null;
  internalApprovedAt: Date | null;
  qcPassedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}

export interface GoogleCalendarTokenRow {
  id: string;
  userId: string;
  accessTokenCipher: string;
  refreshTokenCipher: string | null;
  expiresAt: Date;
  scope: string;
  accountEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingRow {
  id: string;
  organizerId: string;
  briefId: string | null;
  customerUserId: string | null;
  partnerUserId: string | null;
  title: string;
  agenda: string | null;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  meetLink: string | null;
  googleEventId: string | null;
  googleHtmlLink: string | null;
  status: string;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  transcript: string | null;
  transcriptStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  kind: string;
  targetId: string | null;
  targetType: string | null;
  companyId: string | null;
  payload: string;
  requestId: string | null;
  traceId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface FeatureFlagRow {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPct: number;
  audience: string;
  ownerEmail: string | null;
  expiresAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface FeatureFlagChangeRow {
  id: string;
  flagKey: string;
  actorId: string | null;
  before: string;
  after: string;
  reason: string | null;
  createdAt: Date;
}

export interface EmailRow {
  id: string;
  provider: string;
  toAddress: string;
  fromAddress: string | null;
  replyTo: string | null;
  subject: string;
  body: string;
  status: string;
  providerId: string | null;
  errorBody: string | null;
  matchId: string | null;
  briefId: string | null;
  userId: string | null;
  kind: string;
  idemKey: string | null;
  attempt: number;
  scheduledFor: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface RateLimitBucketRow {
  key: string;
  count: number;
  windowSec: number;
  resetAt: Date;
}

export interface AuthSessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  ipHash: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  mfaVerifiedAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export type AttachmentExtractionStatus =
  | "pending"
  | "ready"
  | "failed"
  | "unsupported";

export interface BriefAttachmentRow {
  id: string;
  briefId: string;
  companyId: string;
  uploadedById: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  extractedText: string | null;
  extractionStatus: AttachmentExtractionStatus;
  extractionError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordResetTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AuthMfaCredentialRow {
  id: string;
  userId: string;
  kind: string;
  secretCipher: string;
  recoveryCodes: string;
  enabledAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefTemplateRow {
  id: string;
  slug: string;
  title: string;
  industry: string | null;
  tagline: string;
  icon: string;
  rank: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedViewRow {
  id: string;
  userId: string;
  label: string;
  query: string;
  pinned: boolean;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRadarReportRow {
  id: string;
  briefId: string;
  briefHash: string;
  overall: string;
  findings: string;
  promptVer: string;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  createdAt: Date;
}

export interface NpsResponseRow {
  id: string;
  userId: string;
  briefId: string | null;
  score: number;
  category: string;
  surface: string;
  comment: string | null;
  createdAt: Date;
}

export interface DsrRequestRow {
  id: string;
  userId: string;
  kind: string;
  status: string;
  artefactUrl: string | null;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface RetentionPolicyRow {
  modelName: string;
  ttlDays: number;
  appliesTo: string | null;
  updatedAt: Date;
}

export interface CommentRow {
  id: string;
  briefId: string;
  sectionKey: string;
  anchorOffset: number;
  anchorLength: number;
  parentId: string | null;
  authorId: string;
  body: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefPresenceRow {
  id: string;
  briefId: string;
  userId: string;
  lastSeenAt: Date;
  activity: string;
}

export interface MatchNoteRow {
  id: string;
  matchId: string;
  authorId: string;
  body: string;
  tags: string;
  remindAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalTemplateRow {
  id: string;
  companyId: string;
  label: string;
  description: string | null;
  body: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPasskeyRow {
  id: string;
  userId: string;
  label: string;
  credentialId: string;
  publicKey: string;
  counter: string;
  aaguid: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPasskeyChallengeRow {
  id: string;
  userId: string;
  purpose: string;
  challenge: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface JobRunRow {
  id: string;
  jobName: string;
  idemKey: string | null;
  status: string;
  attempt: number;
  maxAttempts: number;
  payload: string;
  error: string | null;
  scheduledFor: Date;
  nextAttemptAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  requestId: string | null;
  traceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEndpointRow {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  events: string;
  secret: string;
  status: string;
  lastDeliveryAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFails: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  event: string;
  payload: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  scheduledFor: Date;
  nextAttemptAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicApiKeyRow {
  id: string;
  companyId: string;
  createdById: string;
  name: string;
  prefix: string;
  hashedKey: string;
  scopes: string;
  status: string;
  lastUsedAt: Date | null;
  ipAllowlist: string;
  rateLimitRpm: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

export interface CookieConsentRow {
  id: string;
  cookieId: string;
  userId: string | null;
  categories: string;
  action: string;
  policyVersion: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface BriefQaQuestionRow {
  id: string;
  briefId: string;
  askedById: string;
  askedByCompanyId: string;
  question: string;
  questionPublic: string;
  answer: string | null;
  answeredById: string | null;
  status: string;
  visibility: string;
  rejectedReason: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  updatedAt: Date;
}

export interface SubProcessorRow {
  id: string;
  name: string;
  url: string | null;
  purpose: string;
  region: string;
  certifications: string;
  logoUrl: string | null;
  effectiveFrom: Date;
  retiredAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxSessionRow {
  id: string;
  token: string;
  demoUserId: string | null;
  demoBriefId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface PlatformSettingRow {
  key: string;
  value: string;
  description: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimerInstanceRow {
  id: string;
  entityType: string;
  entityId: string;
  timerType: string;
  deadlineAt: Date;
  status: string;
  onExpiryAction: string | null;
  remindersSent: string;
  meta: string;
  satisfiedAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegalDocumentRow {
  id: string;
  docType: string;
  version: number;
  title: string;
  body: string;
  status: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegalAcceptanceRow {
  id: string;
  documentId: string;
  userId: string;
  companyId: string | null;
  acceptedName: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface PartnerContactRow {
  id: string;
  profileId: string;
  name: string;
  role: string | null;
  email: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceQuestionRow {
  id: string;
  fieldKey: string;
  label: string;
  enabled: boolean;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefSectionRow {
  id: string;
  briefId: string;
  key: string;
  content: string;
  aiGenerated: boolean;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalSectionRow {
  id: string;
  proposalId: string;
  key: string;
  content: string;
  pricing: string | null;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnonymizedProposalRow {
  id: string;
  proposalId: string;
  placeholderLabel: string;
  content: string;
  replacedEntities: string;
  llmPassMetadata: string;
  promptVer: string;
  status: string;
  reviewerNotes: string | null;
  humanReviewedBy: string | null;
  humanReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonViewRow {
  id: string;
  briefId: string;
  status: string;
  releasedAt: Date | null;
  releasedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonColumnRow {
  id: string;
  viewId: string;
  matchId: string;
  placeholderLabel: string;
  submissionRank: number;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonCellRow {
  id: string;
  viewId: string;
  placeholderLabel: string;
  sectionKey: string;
  summary: string;
  detail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClarificationThreadRow {
  id: string;
  contextType: string;
  briefId: string;
  matchId: string | null;
  proposalId: string | null;
  anchorSectionKey: string | null;
  status: string;
  createdById: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClarificationMessageRow {
  id: string;
  threadId: string;
  authorId: string;
  authorRole: string;
  kind: string;
  body: string;
  slots: string;
  chosenSlot: string | null;
  createdAt: Date;
}

export interface ProposalVoteRow {
  id: string;
  briefId: string;
  matchId: string;
  userId: string;
  value: string;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplateRow {
  key: string;
  subject: string;
  body: string;
  description: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealReportRow {
  id: string;
  briefId: string;
  matchId: string;
  reportedById: string | null;
  source: string;
  outcome: string;
  contractValueCents: string | null;
  monthlyVolumeCents: string | null;
  startDate: Date | null;
  durationMonths: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchAttachmentRow {
  id: string;
  matchId: string;
  briefId: string;
  partnerId: string;
  uploadedById: string | null;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
}

