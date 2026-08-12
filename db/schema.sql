-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "challengeAreas" TEXT NOT NULL DEFAULT ('[]'),
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "jobTitle" TEXT,
    "location" TEXT,
    "companyId" TEXT,
    "googleId" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "focusArea" TEXT,
    "surveyCompletedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "lastDigestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "googlerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerDomain" TEXT NOT NULL,
    "customerName" TEXT,
    "companyName" TEXT,
    "notes" TEXT,
    "inviteToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedUserId" TEXT,
    "mockEmailBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    -- PENDING | APPROVED | REJECTED — partners may not be sourced or
    -- invited until an admin approves them.
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "domainVerifiedAt" TIMESTAMP(3),
    "signupEmailDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCloudContext" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providers" TEXT NOT NULL DEFAULT ('[]'),
    "resellerStatus" TEXT,
    "resellerWebsite" TEXT,
    "agreementStatus" TEXT,
    "agreementStartDate" DATE,
    "agreementEndDate" DATE,
    "minimumCommitmentUsd" DOUBLE PRECISION,
    "discountPct" DOUBLE PRECISION,
    "gcpGreenfield" BOOLEAN NOT NULL DEFAULT false,
    "renewalWindow" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCloudContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "rawProfile" TEXT NOT NULL DEFAULT ('{}'),
    "anonymizedProfile" TEXT NOT NULL DEFAULT ('{}'),
    "lastExtractedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeCountBand" TEXT,
    "gcpAgreementStatus" TEXT,
    "gcpContractEndDate" TIMESTAMP(3),
    "gcpDiscountPct" DOUBLE PRECISION,
    "resellInterest" TEXT,
    "onboardingQuestionsState" TEXT NOT NULL DEFAULT ('{}'),

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "website" TEXT,
    "headquarters" TEXT,
    "teamSize" TEXT,
    "industry" TEXT,
    "languages" TEXT NOT NULL DEFAULT ('[]'),
    "regions" TEXT NOT NULL DEFAULT ('[]'),
    "tier" TEXT NOT NULL DEFAULT 'MEMBER',
    "specializations" TEXT NOT NULL DEFAULT ('[]'),
    "expertiseAreas" TEXT NOT NULL DEFAULT ('[]'),
    "awards" TEXT NOT NULL DEFAULT ('[]'),
    "directoryUrl" TEXT,
    "logoUrl" TEXT,
    "caseStudies" TEXT NOT NULL DEFAULT ('[]'),
    "keyClients" TEXT NOT NULL DEFAULT ('[]'),
    "industryExperience" TEXT NOT NULL DEFAULT ('[]'),
    "certifications" TEXT NOT NULL DEFAULT ('[]'),
    "differentiators" TEXT NOT NULL DEFAULT ('[]'),
    "officeLocations" TEXT NOT NULL DEFAULT ('[]'),
    "serviceModels" TEXT NOT NULL DEFAULT ('[]'),
    "gcpTier" TEXT,
    "partnerSince" TEXT,
    "leadRoutingEmail" TEXT,
    "acceptedTermsAt" TIMESTAMP(3),
    "acceptedTermsBy" TEXT,
    "acceptedTermsName" TEXT,
    "clouds" TEXT NOT NULL DEFAULT ('["gcp"]'),
    "sizeBand" TEXT,
    "tncStatus" TEXT NOT NULL DEFAULT 'not_sent',
    "tncVersion" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'imported',
    -- 5-pillar structured intake (20260809_partner_pillars_and_tags).
    "ipAssets" TEXT NOT NULL DEFAULT ('[]'),
    "resellPlatforms" TEXT,
    "engagementModels" TEXT NOT NULL DEFAULT ('[]'),
    "minDealSize" TEXT,
    "typicalContractMonths" TEXT,
    "pocOffering" TEXT,
    "pocFixedFee" INTEGER,
    "pocTurnaroundDays" INTEGER,
    "benchAvailability" TEXT,
    "seniorityRatio" INTEGER,
    "collaborationStyles" TEXT NOT NULL DEFAULT ('[]'),
    "valueRanges" TEXT NOT NULL DEFAULT ('{}'),
    "referenceAvailability" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastScrapedAt" TIMESTAMP(3),
    "profileStrength" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingStep" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "facet" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "suggestedByCount" INTEGER NOT NULL DEFAULT 0,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "facet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileChangeProposal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "fieldKey" TEXT NOT NULL,
    "currentValue" TEXT,
    "proposedValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBrief" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Project Brief',
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'INTAKE',
    "leadState" TEXT NOT NULL DEFAULT 'DRAFT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "completion" INTEGER NOT NULL DEFAULT 0,
    "services" TEXT NOT NULL DEFAULT ('[]'),
    "source" TEXT NOT NULL DEFAULT 'ai_builder',
    "intentRoute" TEXT NOT NULL DEFAULT 'TECHNICAL',
    "deliveryModel" TEXT NOT NULL DEFAULT ('[]'),
    "cloudContextSnapshot" TEXT NOT NULL DEFAULT ('{}'),
    "procurement" TEXT NOT NULL DEFAULT 'UNSURE',
    "usesCloud" BOOLEAN NOT NULL DEFAULT false,
    "hadPartner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "meetingProposedSlots" TEXT NOT NULL DEFAULT ('[]'),
    "meetingConfirmedAt" TIMESTAMP(3),
    "meetingConfirmedBy" TEXT,
    "meetingAgenda" TEXT,
    "triagedAt" TIMESTAMP(3),
    "triagedBy" TEXT,
    "triageNotes" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'ai_self_service',
    "callRecordingRef" TEXT,
    "callTranscript" TEXT,
    "anonymizedCompanySummary" TEXT,
    "selectionDeadlineAt" TIMESTAMP(3),
    "partnerPreferences" TEXT NOT NULL DEFAULT ('{}'),
    "executiveSummary" TEXT,
    "scopeRequirements" TEXT NOT NULL DEFAULT ('[]'),
    "dataSources" TEXT NOT NULL DEFAULT ('[]'),
    "integrationPoints" TEXT NOT NULL DEFAULT ('[]'),
    "successCriteria" TEXT NOT NULL DEFAULT ('[]'),
    "customerRoles" TEXT NOT NULL DEFAULT ('[]'),
    "targetGoLive" TEXT,
    "milestones" TEXT NOT NULL DEFAULT ('[]'),
    "budgetRange" TEXT,
    "budgetNotes" TEXT,
    "preferredLocation" TEXT,
    "requiredCertifications" TEXT NOT NULL DEFAULT ('[]'),
    "industryExperience" TEXT NOT NULL DEFAULT ('[]'),
    "procurementType" TEXT,
    "decisionMakers" TEXT NOT NULL DEFAULT ('[]'),
    "selectionCriteria" TEXT NOT NULL DEFAULT ('[]'),
    "legalTimeline" TEXT,
    "reviewWorkflowConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "requiresInternalReview" BOOLEAN NOT NULL DEFAULT false,
    "internalReviewerName" TEXT,
    "internalReviewerEmail" TEXT,
    "internalReviewerRole" TEXT,
    "requiresInternalApproval" BOOLEAN NOT NULL DEFAULT false,
    "internalApproverName" TEXT,
    "internalApproverEmail" TEXT,
    "internalApproverRole" TEXT,
    "reviewWorkflowNotes" TEXT,

    CONSTRAINT "ProjectBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefCollaborator" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteToken" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "userId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "mockEmailBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefAttachment" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "extractionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefAccess" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefAccessRequest" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SOURCED',
    "note" TEXT,
    "outreachToken" TEXT,
    "outreachEmail" TEXT,
    "outreachSentAt" TIMESTAMP(3),
    "forwardedFromEmail" TEXT,
    "mockEmailBody" TEXT,
    "acceptedTermsAt" TIMESTAMP(3),
    "acceptedTermsBy" TEXT,
    "acceptedTermsName" TEXT,
    "acceptedTermsIp" TEXT,
    "acceptedTermsUa" TEXT,
    "customerPriority" INTEGER,
    "matchRationale" TEXT,
    "matchRationaleVer" TEXT,
    "matchScore" INTEGER,
    "declineReason" TEXT,
    "declineNote" TEXT,
    "winLossReasons" TEXT,
    "acceptDeadlineAt" TIMESTAMP(3),
    "proposalDeadlineAt" TIMESTAMP(3),
    "extensionUsed" BOOLEAN NOT NULL DEFAULT false,
    "extensionRequestedAt" TIMESTAMP(3),
    "extensionNote" TEXT,
    "extensionResolvedAt" TIMESTAMP(3),
    "extensionGrantedBy" TEXT,
    "placeholderLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "approach" TEXT,
    "teamComposition" TEXT NOT NULL DEFAULT ('[]'),
    "timelineWeeks" INTEGER,
    "totalCost" INTEGER,
    "costBreakdown" TEXT NOT NULL DEFAULT ('[]'),
    "strengths" TEXT NOT NULL DEFAULT ('[]'),
    "risks" TEXT NOT NULL DEFAULT ('[]'),
    "docUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "internalApprovedById" TEXT,
    "internalApprovedAt" TIMESTAMP(3),
    "qcPassedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "idemKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenCipher" TEXT NOT NULL,
    "refreshTokenCipher" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "accountEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "briefId" TEXT,
    "customerUserId" TEXT,
    "partnerUserId" TEXT,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "meetLink" TEXT,
    "googleEventId" TEXT,
    "googleHtmlLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "transcript" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "companyId" TEXT,
    "payload" TEXT NOT NULL DEFAULT ('{}'),
    "requestId" TEXT,
    "traceId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPct" INTEGER NOT NULL DEFAULT 0,
    "audience" TEXT NOT NULL DEFAULT ('{}'),
    "ownerEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FeatureFlagChange" (
    "id" TEXT NOT NULL,
    "flagKey" TEXT NOT NULL,
    "actorId" TEXT,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlagChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "toAddress" TEXT NOT NULL,
    "fromAddress" TEXT,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerId" TEXT,
    "errorBody" TEXT,
    "matchId" TEXT,
    "briefId" TEXT,
    "userId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'system',
    "idemKey" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowSec" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "mfaVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "proposalId" TEXT,
    "partnerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "acceptedScope" TEXT,
    "contractValueCents" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "startDate" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "feeModel" TEXT,
    "feeBps" INTEGER,
    "feeAmountCents" BIGINT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "acceptedByName" TEXT,
    "acceptedIp" TEXT,
    "acceptedUa" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMilestone" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceJoinRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterCompanyId" TEXT,
    "emailDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronRun" (
    "job" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" BIGINT NOT NULL DEFAULT 0,
    "expectedIntervalMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("job")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthMfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'totp',
    "secretCipher" TEXT NOT NULL,
    "recoveryCodes" TEXT NOT NULL DEFAULT ('[]'),
    "enabledAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthMfaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industry" TEXT,
    "tagline" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'sparkles',
    "rank" INTEGER NOT NULL DEFAULT 100,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRadarReport" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "briefHash" TEXT NOT NULL,
    "overall" TEXT NOT NULL,
    "findings" TEXT NOT NULL DEFAULT ('[]'),
    "promptVer" TEXT NOT NULL DEFAULT 'v1',
    "failureReason" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskRadarReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "briefId" TEXT,
    "score" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DsrRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "artefactUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DsrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "modelName" TEXT NOT NULL,
    "ttlDays" INTEGER NOT NULL,
    "appliesTo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("modelName")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "anchorOffset" INTEGER NOT NULL DEFAULT 0,
    "anchorLength" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefPresence" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity" TEXT NOT NULL DEFAULT 'viewing',

    CONSTRAINT "BriefPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchNote" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT ('[]'),
    "remindAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthPasskey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "aaguid" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthPasskey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthPasskeyChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthPasskeyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "idemKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "payload" TEXT NOT NULL DEFAULT ('{}'),
    "error" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "requestId" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "events" TEXT NOT NULL DEFAULT ('[]'),
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastDeliveryAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT ('[]'),
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMP(3),
    "ipAllowlist" TEXT NOT NULL DEFAULT ('[]'),
    "rateLimitRpm" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "PublicApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "cookieId" TEXT NOT NULL,
    "userId" TEXT,
    "categories" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefQaQuestion" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "askedById" TEXT NOT NULL,
    "askedByCompanyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionPublic" TEXT NOT NULL,
    "answer" TEXT,
    "answeredById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "visibility" TEXT NOT NULL DEFAULT 'all-partners',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefQaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubProcessor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "purpose" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "certifications" TEXT NOT NULL DEFAULT ('[]'),
    "logoUrl" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubProcessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "demoUserId" TEXT,
    "demoBriefId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TimerInstance" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timerType" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "onExpiryAction" TEXT,
    "remindersSent" TEXT NOT NULL DEFAULT ('[]'),
    "meta" TEXT NOT NULL DEFAULT ('{}'),
    "satisfiedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "acceptedName" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceQuestion" (
    "id" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefSection" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pricing" TEXT,
    "pricingModel" TEXT,
    "pricingAmountCents" BIGINT,
    "pricingCurrency" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymizedProposal" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "placeholderLabel" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "replacedEntities" TEXT NOT NULL DEFAULT ('[]'),
    "llmPassMetadata" TEXT NOT NULL DEFAULT ('{}'),
    "promptVer" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "reviewerNotes" TEXT,
    "humanReviewedBy" TEXT,
    "humanReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonymizedProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonView" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonColumn" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "placeholderLabel" TEXT NOT NULL,
    "submissionRank" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonCell" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "placeholderLabel" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationThread" (
    "id" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "matchId" TEXT,
    "proposalId" TEXT,
    "anchorSectionKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClarificationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "slots" TEXT NOT NULL DEFAULT ('[]'),
    "chosenSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalVote" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DealReport" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reportedById" TEXT,
    "source" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "contractValueCents" BIGINT,
    "monthlyVolumeCents" BIGINT,
    "startDate" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_inviteToken_key" ON "Lead"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_claimedUserId_key" ON "Lead"("claimedUserId");

-- CreateIndex
CREATE INDEX "Lead_googlerId_idx" ON "Lead"("googlerId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Company_kind_idx" ON "Company"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_companyId_userId_key" ON "WorkspaceMembership"("companyId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_companyId_status_idx" ON "WorkspaceMembership"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_tokenHash_key" ON "WorkspaceInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_companyId_status_idx" ON "WorkspaceInvite"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_companyId_email_invited_key" ON "WorkspaceInvite"("companyId", "email") WHERE "status" = 'INVITED';

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_companyId_lower_email_invited_key" ON "WorkspaceInvite"("companyId", lower("email")) WHERE "status" = 'INVITED';

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCloudContext_companyId_key" ON "CompanyCloudContext"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_companyId_key" ON "CustomerProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_companyId_key" ON "PartnerProfile"("companyId");

-- CreateIndex
CREATE INDEX "PartnerProfile_lastVerifiedAt_idx" ON "PartnerProfile"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "PartnerProfile_profileStrength_idx" ON "PartnerProfile"("profileStrength" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_facet_slug_key" ON "Tag"("facet", lower("slug"));

-- CreateIndex
CREATE INDEX "Tag_status_idx" ON "Tag"("status");

-- CreateIndex
CREATE INDEX "Tag_facet_idx" ON "Tag"("facet");

-- CreateIndex
CREATE INDEX "Tag_useCount_idx" ON "Tag"("useCount" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTag_company_tag_key" ON "PartnerTag"("companyId", "tagId");

-- CreateIndex
CREATE INDEX "PartnerTag_companyId_facet_idx" ON "PartnerTag"("companyId", "facet");

-- CreateIndex
CREATE INDEX "PartnerTag_tagId_idx" ON "PartnerTag"("tagId");

-- CreateIndex
CREATE INDEX "ProfileChangeProposal_companyId_status_idx" ON "ProfileChangeProposal"("companyId", "status");

-- CreateIndex
CREATE INDEX "ProfileChangeProposal_createdAt_idx" ON "ProfileChangeProposal"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectBrief_ownerId_idx" ON "ProjectBrief"("ownerId");

-- CreateIndex
CREATE INDEX "ProjectBrief_companyId_idx" ON "ProjectBrief"("companyId");

-- CreateIndex
CREATE INDEX "ProjectBrief_stage_idx" ON "ProjectBrief"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "BriefCollaborator_inviteToken_key" ON "BriefCollaborator"("inviteToken");

-- CreateIndex
CREATE INDEX "BriefCollaborator_briefId_idx" ON "BriefCollaborator"("briefId");

-- CreateIndex
CREATE INDEX "BriefCollaborator_email_idx" ON "BriefCollaborator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BriefCollaborator_briefId_email_key" ON "BriefCollaborator"("briefId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "BriefAccess_briefId_userId_key" ON "BriefAccess"("briefId", "userId");

-- CreateIndex
CREATE INDEX "BriefAccess_userId_status_idx" ON "BriefAccess"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BriefAccessRequest_briefId_requester_pending_key" ON "BriefAccessRequest"("briefId", "requesterId") WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "BriefAccessRequest_briefId_status_idx" ON "BriefAccessRequest"("briefId", "status");

-- CreateIndex
CREATE INDEX "ChatMessage_briefId_idx" ON "ChatMessage"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_outreachToken_key" ON "Match"("outreachToken");

-- CreateIndex
CREATE INDEX "Match_partnerId_idx" ON "Match"("partnerId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_briefId_partnerId_key" ON "Match"("briefId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_matchId_key" ON "Proposal"("matchId");

-- CreateIndex
CREATE INDEX "Proposal_briefId_idx" ON "Proposal"("briefId");

-- CreateIndex
CREATE INDEX "Proposal_partnerId_idx" ON "Proposal"("partnerId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarToken_userId_key" ON "GoogleCalendarToken"("userId");

-- CreateIndex
CREATE INDEX "Meeting_briefId_startsAt_idx" ON "Meeting"("briefId", "startsAt");

-- CreateIndex
CREATE INDEX "Meeting_organizerId_startsAt_idx" ON "Meeting"("organizerId", "startsAt");

-- CreateIndex
CREATE INDEX "Meeting_status_startsAt_idx" ON "Meeting"("status", "startsAt");

-- CreateIndex
CREATE INDEX "AuditLog_kind_createdAt_idx" ON "AuditLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeatureFlagChange_flagKey_createdAt_idx" ON "FeatureFlagChange"("flagKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Email_idemKey_key" ON "Email"("idemKey");

-- CreateIndex
CREATE INDEX "Email_status_createdAt_idx" ON "Email"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Email_toAddress_idx" ON "Email"("toAddress");

-- CreateIndex
CREATE INDEX "Email_briefId_idx" ON "Email"("briefId");

-- CreateIndex
CREATE INDEX "Email_matchId_idx" ON "Email"("matchId");

-- CreateIndex
CREATE INDEX "Email_userId_idx" ON "Email"("userId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "BriefAttachment_briefId_idx" ON "BriefAttachment"("briefId");

-- CreateIndex
CREATE INDEX "BriefAttachment_companyId_idx" ON "BriefAttachment"("companyId");

-- CreateIndex
CREATE INDEX "BriefAttachment_createdAt_idx" ON "BriefAttachment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthMfaCredential_userId_key" ON "AuthMfaCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefTemplate_slug_key" ON "BriefTemplate"("slug");

-- CreateIndex
CREATE INDEX "BriefTemplate_rank_idx" ON "BriefTemplate"("rank");

-- CreateIndex
CREATE INDEX "SavedView_userId_pinned_idx" ON "SavedView"("userId", "pinned");

-- CreateIndex
CREATE INDEX "RiskRadarReport_briefId_createdAt_idx" ON "RiskRadarReport"("briefId", "createdAt");

-- CreateIndex
CREATE INDEX "NpsResponse_score_createdAt_idx" ON "NpsResponse"("score", "createdAt");

-- CreateIndex
CREATE INDEX "NpsResponse_surface_createdAt_idx" ON "NpsResponse"("surface", "createdAt");

-- CreateIndex
CREATE INDEX "DsrRequest_userId_status_idx" ON "DsrRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "DsrRequest_status_createdAt_idx" ON "DsrRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_briefId_sectionKey_resolvedAt_idx" ON "Comment"("briefId", "sectionKey", "resolvedAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "BriefPresence_briefId_lastSeenAt_idx" ON "BriefPresence"("briefId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BriefPresence_briefId_userId_key" ON "BriefPresence"("briefId", "userId");

-- CreateIndex
CREATE INDEX "MatchNote_matchId_createdAt_idx" ON "MatchNote"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchNote_authorId_idx" ON "MatchNote"("authorId");

-- CreateIndex
CREATE INDEX "MatchNote_remindAt_idx" ON "MatchNote"("remindAt");

-- CreateIndex
CREATE INDEX "ProposalTemplate_companyId_rank_idx" ON "ProposalTemplate"("companyId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "AuthPasskey_credentialId_key" ON "AuthPasskey"("credentialId");

-- CreateIndex
CREATE INDEX "AuthPasskey_userId_idx" ON "AuthPasskey"("userId");

-- CreateIndex
CREATE INDEX "AuthPasskeyChallenge_userId_purpose_idx" ON "AuthPasskeyChallenge"("userId", "purpose");

-- CreateIndex
CREATE INDEX "AuthPasskeyChallenge_expiresAt_idx" ON "AuthPasskeyChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "JobRun_status_scheduledFor_idx" ON "JobRun"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "JobRun_jobName_createdAt_idx" ON "JobRun"("jobName", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_jobName_idemKey_key" ON "JobRun"("jobName", "idemKey");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_companyId_idx" ON "WebhookEndpoint"("companyId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_status_idx" ON "WebhookEndpoint"("status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_status_idx" ON "WebhookDelivery"("endpointId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_scheduledFor_idx" ON "WebhookDelivery"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "PublicApiKey_hashedKey_key" ON "PublicApiKey"("hashedKey");

-- CreateIndex
CREATE INDEX "PublicApiKey_companyId_idx" ON "PublicApiKey"("companyId");

-- CreateIndex
CREATE INDEX "PublicApiKey_prefix_idx" ON "PublicApiKey"("prefix");

-- CreateIndex
CREATE INDEX "PublicApiKey_status_idx" ON "PublicApiKey"("status");

-- CreateIndex
CREATE INDEX "CookieConsent_cookieId_idx" ON "CookieConsent"("cookieId");

-- CreateIndex
CREATE INDEX "CookieConsent_userId_idx" ON "CookieConsent"("userId");

-- CreateIndex
CREATE INDEX "BriefQaQuestion_briefId_status_idx" ON "BriefQaQuestion"("briefId", "status");

-- CreateIndex
CREATE INDEX "BriefQaQuestion_askedByCompanyId_idx" ON "BriefQaQuestion"("askedByCompanyId");

-- CreateIndex
CREATE INDEX "SubProcessor_retiredAt_idx" ON "SubProcessor"("retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSession_token_key" ON "SandboxSession"("token");

-- CreateIndex
CREATE INDEX "SandboxSession_expiresAt_idx" ON "SandboxSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TimerInstance_status_deadlineAt_idx" ON "TimerInstance"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "TimerInstance_entityType_entityId_timerType_idx" ON "TimerInstance"("entityType", "entityId", "timerType");

-- CreateIndex
CREATE INDEX "LegalDocument_docType_status_idx" ON "LegalDocument"("docType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_docType_version_key" ON "LegalDocument"("docType", "version");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_idx" ON "LegalAcceptance"("userId");

-- CreateIndex
CREATE INDEX "LegalAcceptance_companyId_idx" ON "LegalAcceptance"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_documentId_userId_key" ON "LegalAcceptance"("documentId", "userId");

-- CreateIndex
CREATE INDEX "PartnerContact_profileId_idx" ON "PartnerContact"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceQuestion_fieldKey_key" ON "PreferenceQuestion"("fieldKey");

-- CreateIndex
CREATE INDEX "PreferenceQuestion_enabled_rank_idx" ON "PreferenceQuestion"("enabled", "rank");

-- CreateIndex
CREATE INDEX "BriefSection_briefId_rank_idx" ON "BriefSection"("briefId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "BriefSection_briefId_key_key" ON "BriefSection"("briefId", "key");

-- CreateIndex
CREATE INDEX "ProposalSection_proposalId_rank_idx" ON "ProposalSection"("proposalId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSection_proposalId_key_key" ON "ProposalSection"("proposalId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymizedProposal_proposalId_key" ON "AnonymizedProposal"("proposalId");

-- CreateIndex
CREATE INDEX "AnonymizedProposal_status_idx" ON "AnonymizedProposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonView_briefId_key" ON "ComparisonView"("briefId");

-- CreateIndex
CREATE INDEX "ComparisonColumn_viewId_submissionRank_idx" ON "ComparisonColumn"("viewId", "submissionRank");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonColumn_viewId_placeholderLabel_key" ON "ComparisonColumn"("viewId", "placeholderLabel");

-- CreateIndex
CREATE INDEX "ComparisonCell_viewId_idx" ON "ComparisonCell"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonCell_viewId_placeholderLabel_sectionKey_key" ON "ComparisonCell"("viewId", "placeholderLabel", "sectionKey");

-- CreateIndex
CREATE INDEX "ClarificationThread_briefId_contextType_status_idx" ON "ClarificationThread"("briefId", "contextType", "status");

-- CreateIndex
CREATE INDEX "ClarificationThread_matchId_idx" ON "ClarificationThread"("matchId");

-- CreateIndex
CREATE INDEX "ClarificationMessage_threadId_createdAt_idx" ON "ClarificationMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalVote_briefId_idx" ON "ProposalVote"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVote_matchId_userId_key" ON "ProposalVote"("matchId", "userId");

-- CreateIndex
CREATE INDEX "DealReport_briefId_idx" ON "DealReport"("briefId");

-- CreateIndex
CREATE INDEX "DealReport_matchId_idx" ON "DealReport"("matchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_googlerId_fkey" FOREIGN KEY ("googlerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_claimedUserId_fkey" FOREIGN KEY ("claimedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCloudContext" ADD CONSTRAINT "CompanyCloudContext_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTag" ADD CONSTRAINT "PartnerTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTag" ADD CONSTRAINT "PartnerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeProposal" ADD CONSTRAINT "ProfileChangeProposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeProposal" ADD CONSTRAINT "ProfileChangeProposal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBrief" ADD CONSTRAINT "ProjectBrief_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBrief" ADD CONSTRAINT "ProjectBrief_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefCollaborator" ADD CONSTRAINT "BriefCollaborator_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefCollaborator" ADD CONSTRAINT "BriefCollaborator_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefCollaborator" ADD CONSTRAINT "BriefCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccess" ADD CONSTRAINT "BriefAccess_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccess" ADD CONSTRAINT "BriefAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccess" ADD CONSTRAINT "BriefAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccessRequest" ADD CONSTRAINT "BriefAccessRequest_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccessRequest" ADD CONSTRAINT "BriefAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAccessRequest" ADD CONSTRAINT "BriefAccessRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagChange" ADD CONSTRAINT "FeatureFlagChange_flagKey_fkey" FOREIGN KEY ("flagKey") REFERENCES "FeatureFlag"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAttachment" ADD CONSTRAINT "BriefAttachment_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefAttachment" ADD CONSTRAINT "BriefAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthMfaCredential" ADD CONSTRAINT "AuthMfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRadarReport" ADD CONSTRAINT "RiskRadarReport_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DsrRequest" ADD CONSTRAINT "DsrRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefPresence" ADD CONSTRAINT "BriefPresence_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefPresence" ADD CONSTRAINT "BriefPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchNote" ADD CONSTRAINT "MatchNote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchNote" ADD CONSTRAINT "MatchNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalTemplate" ADD CONSTRAINT "ProposalTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthPasskey" ADD CONSTRAINT "AuthPasskey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthPasskeyChallenge" ADD CONSTRAINT "AuthPasskeyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicApiKey" ADD CONSTRAINT "PublicApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicApiKey" ADD CONSTRAINT "PublicApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQaQuestion" ADD CONSTRAINT "BriefQaQuestion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQaQuestion" ADD CONSTRAINT "BriefQaQuestion_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQaQuestion" ADD CONSTRAINT "BriefQaQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefSection" ADD CONSTRAINT "BriefSection_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymizedProposal" ADD CONSTRAINT "AnonymizedProposal_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonView" ADD CONSTRAINT "ComparisonView_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonColumn" ADD CONSTRAINT "ComparisonColumn_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ComparisonView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonCell" ADD CONSTRAINT "ComparisonCell_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ComparisonView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationThread" ADD CONSTRAINT "ClarificationThread_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationMessage" ADD CONSTRAINT "ClarificationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ClarificationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReport" ADD CONSTRAINT "DealReport_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReport" ADD CONSTRAINT "DealReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

