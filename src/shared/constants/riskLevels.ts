export const RISK_LEVELS = {
  LOW: { min: 0, max: 25, label: "Low Risk" },
  MEDIUM: { min: 26, max: 50, label: "Medium Risk" },
  HIGH: { min: 51, max: 75, label: "High Risk" },
  CRITICAL: { min: 76, max: 100, label: "Critical Risk" },
} as const;

export function getRiskLevelLabel(score: number): string {
  if (score <= 25) return RISK_LEVELS.LOW.label;
  if (score <= 50) return RISK_LEVELS.MEDIUM.label;
  if (score <= 75) return RISK_LEVELS.HIGH.label;
  return RISK_LEVELS.CRITICAL.label;
}
