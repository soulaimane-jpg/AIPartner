export type CloudProvider = {
  provider: "gcp" | "aws" | "azure" | "other";
  spendBand: string | null;
};

export function deriveCloudContext(
  providers: CloudProvider[],
  agreementEndDate: Date | null,
  now = new Date(),
): { gcpGreenfield: boolean; renewalWindow: boolean } {
  const gcp = providers.find((entry) => entry.provider === "gcp");
  const gcpGreenfield = !gcp || !gcp.spendBand || gcp.spendBand === "prefer_not_to_share";
  const twelveMonths = new Date(now);
  twelveMonths.setUTCMonth(twelveMonths.getUTCMonth() + 12);
  const renewalWindow = Boolean(
    agreementEndDate && agreementEndDate >= startOfUtcDay(now) && agreementEndDate <= twelveMonths,
  );
  return { gcpGreenfield, renewalWindow };
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
