import { GoogleGenAI } from "@google/genai";
import config from "../config";
import logger from "../shared/logger";

let ai: GoogleGenAI | null = null;

if (config.gemini.apiKey && config.gemini.apiKey !== "YOUR_GEMINI_API_KEY") {
  logger.info("Initializing GoogleGenAI SDK client...");
  ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
} else {
  logger.warn("GEMINI_API_KEY is not configured. AI summary generation will be bypassed.");
}

/**
 * Generates an AI summary and safety recommendations using the Gemini API.
 * Falls back to a template summary if the API key is missing or the call fails.
 */
export async function generateAiSummary(params: {
  url: string;
  finalUrl: string;
  redirectChain: any[];
  metadata: any;
  findings: any[];
}): Promise<string> {
  const { url, finalUrl, redirectChain, metadata, findings } = params;

  if (!ai) {
    logger.warn("Gemini client not initialized. Falling back to template summary.");
    return generateFallbackSummary(params);
  }

  const prompt = `
You are SecureBuddy, an advanced AI security assistant. Analyze the website details below:
- Submitted URL: ${url}
- Final Landed URL: ${finalUrl}
- Redirect Chain: ${JSON.stringify(redirectChain)}
- Page Title: ${metadata.title || "None"}
- Page Description: ${metadata.description || "None"}
- Security Findings: ${JSON.stringify(findings)}

Based on these inputs, provide a security summary report. You must output:
1. SUMMARY: A 2-3 sentence description of the site and its intent. Highlight any safety anomalies (like redirection or HTTP status).
2. RISK ASSESSMENT: An explanation of any suspicious features.
3. RECOMMENDATIONS: Bullet points of direct instructions for the user (e.g., "Do not enter passwords", "Safe to visit", "Phishing risk").

Do not escape markdown symbols with backslashes. Use standard Markdown formatting.
`;

  try {
    logger.info("Requesting content generation from Gemini API (gemini-2.5-flash)...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    if (response.text) {
      return response.text.trim();
    }
    throw new Error("Empty response from Gemini API");
  } catch (error: any) {
    logger.error("Gemini API call failed, using fallback:", error.message);
    return generateFallbackSummary(params);
  }
}

/**
 * Creates a basic summary based on the findings when Gemini is unavailable.
 */
function generateFallbackSummary(params: {
  url: string;
  finalUrl: string;
  redirectChain: any[];
  findings: any[];
}): string {
  const hasHighRisk = params.findings.some(f => f.severity === "high" || f.severity === "critical");
  const hasMediumRisk = params.findings.some(f => f.severity === "medium");

  let summary = `### Analysis Report Summary\n\n`;
  summary += `• Checked destination: **${params.finalUrl}**.\n`;
  
  if (params.redirectChain.length > 0) {
    summary += `• Redirect chain hops: **${params.redirectChain.length}**.\n`;
  }

  summary += `\n### Risk Assessment\n`;
  if (hasHighRisk) {
    summary += `⚠️ **High Risk**: Multiple suspicious patterns or redirects were discovered. Browsing this site is dangerous.\n`;
  } else if (hasMediumRisk) {
    summary += `⚠️ **Medium Risk**: Potential vulnerabilities (such as missing HTTPS encryption) were found.\n`;
  } else {
    summary += `✅ **Low Risk**: No immediate security threats or redirects were detected.\n`;
  }

  summary += `\n### Recommendations\n`;
  if (hasHighRisk) {
    summary += `• Avoid visiting this website.\n• Do not enter credentials, personal data, or payment information.`;
  } else if (hasMediumRisk) {
    summary += `• Exercise caution if inputting sensitive information.\n• Check the browser URL bar for warnings.`;
  } else {
    summary += `• Safe to access under normal browsing conditions.`;
  }

  return summary;
}
