export interface Finding {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
}

export interface RiskAnalysisResult {
  riskScore: number;
  findings: Finding[];
}

const KNOWN_SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "rebrand.ly",
  "buff.ly",
  "adf.ly",
  "ow.ly",
  "t.me",
  "shorturl.at",
];

const SUSPICIOUS_TLDS = [
  ".xyz",
  ".top",
  ".click",
  ".gq",
  ".cf",
  ".tk",
  ".ml",
  ".fit",
  ".buzz",
  ".country",
  ".download",
  ".work",
  ".men",
];

/**
 * Calculates a risk score and compiles findings for a URL analysis report.
 * @param initialUrl The initial URL submitted.
 * @param finalUrl The final navigated URL.
 * @param redirectChain The chain of redirects captured during analysis.
 */
export function analyzeUrlRisk(
  initialUrl: string,
  finalUrl: string,
  redirectChain: any[]
): RiskAnalysisResult {
  let score = 10; // Baseline score for normal websites
  const findings: Finding[] = [];

  // Parse hostnames
  let initialHost = "";
  let finalHost = "";
  try {
    initialHost = new URL(initialUrl).hostname.toLowerCase();
  } catch (_) {}
  try {
    finalHost = new URL(finalUrl).hostname.toLowerCase();
  } catch (_) {}

  // 1. Check for missing HTTPS (Unencrypted HTTP connection)
  if (finalUrl.startsWith("http://")) {
    score += 25;
    findings.push({
      severity: "medium",
      title: "Unencrypted HTTP Connection",
      description: "The final destination URL does not use SSL/TLS encryption (HTTPS), making communications vulnerable to snooping.",
    });
  }

  // 2. Check for URL shorteners
  const isShortener = KNOWN_SHORTENERS.some(
    (shortener) => initialHost === shortener || initialHost.endsWith("." + shortener)
  );
  if (isShortener) {
    score += 15;
    findings.push({
      severity: "low",
      title: "URL Shortener Masking",
      description: "The initial link was processed through a shortening service, which masks the final destination hostname from users.",
    });
  }

  // 3. Check for excessive redirects
  const redirectCount = redirectChain.length;
  if (redirectCount >= 3) {
    score += 30;
    findings.push({
      severity: "high",
      title: "Excessive Redirects Detected",
      description: `The request went through ${redirectCount} redirect hops, which is typical of malicious campaign evasion and traffic routing.`,
    });
  } else if (redirectCount > 0) {
    score += redirectCount * 5; // Minimal points for minor redirects
  }

  // 4. Check for suspicious Top-Level Domains (TLDs)
  const matchedTld = SUSPICIOUS_TLDS.find((tld) => finalHost.endsWith(tld));
  if (matchedTld) {
    score += 25;
    findings.push({
      severity: "medium",
      title: "Suspicious Top-Level Domain (TLD)",
      description: `The destination domain ends with the TLD [${matchedTld}], which is commonly associated with spam campaigns, low-cost registration, and malicious hosts.`,
    });
  }

  // Cap score between 0 and 100
  const riskScore = Math.max(0, Math.min(100, score));

  return {
    riskScore,
    findings,
  };
}
