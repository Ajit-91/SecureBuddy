import { BotContext } from "../../shared/types/telegram";
import { Types } from "mongoose";
import AnalysisJob from "../../models/AnalysisJob";
import Report from "../../models/Report";
import { escapeHtml } from "../../utils/escape";
import { getRiskLevelLabel } from "../../shared/constants/riskLevels";
import logger from "../../shared/logger";

/**
 * Handles the /report <jobId> command, returning security report details for a specific analysis job.
 */
export async function reportHandler(ctx: BotContext): Promise<void> {
  const text = ctx.match || "";
  const jobId = (typeof text === "string" ? text : String(text)).trim();

  if (!jobId) {
    await ctx.reply("⚠️ Please provide a job ID.\nExample: `/report <job_id>`", { parse_mode: "Markdown" });
    return;
  }

  if (!Types.ObjectId.isValid(jobId)) {
    await ctx.reply("⚠️ Invalid Job ID format. Please check the ID and try again.");
    return;
  }

  try {
    const job = await AnalysisJob.findOne({ _id: jobId, userId: ctx.dbUser!._id });

    if (!job) {
      await ctx.reply(`❌ Report not found for Job ID: <code>${escapeHtml(jobId)}</code>`, { parse_mode: "HTML" });
      return;
    }

    if (job.status === "queued") {
      await ctx.reply(`⏳ Job <code>${escapeHtml(jobId)}</code> is currently queued. Please check back shortly.`, { parse_mode: "HTML" });
      return;
    }

    if (job.status === "processing") {
      await ctx.reply(`⚙️ Job <code>${escapeHtml(jobId)}</code> is currently processing. Please check back shortly.`, { parse_mode: "HTML" });
      return;
    }

    if (job.status === "failed") {
      await ctx.reply(`❌ Job <code>${escapeHtml(jobId)}</code> failed.\n\n<b>Error:</b> ${escapeHtml(job.errorMessage || "Unknown error occurred.")}`, { parse_mode: "HTML" });
      return;
    }

    // status is completed
    const report = await Report.findOne({ jobId: job._id });
    if (!report) {
      await ctx.reply(`⚠️ No report found for completed Job ID: <code>${escapeHtml(jobId)}</code>`, { parse_mode: "HTML" });
      return;
    }

    const typeStr = job.type.toUpperCase();
    const name = job.displayName || job.originalFileName || job.inputValue || "Unknown";
    const findingsText =
      report.findings.length > 0
        ? report.findings
            .map((f: any) => `• [${f.severity.toUpperCase()}] <b>${escapeHtml(f.title)}</b>: ${escapeHtml(f.description || "")}`)
            .join("\n")
        : "• No immediate security risks detected.";

    const reportText = `📊 <b>SecureBuddy Security Report</b>

<b>Job ID:</b> <code>${job._id}</code>
<b>Type:</b> <code>${typeStr}</code>
<b>Target:</b> <code>${escapeHtml(name)}</code>

<b>Risk Score:</b> <b>${report.riskScore} / 100</b> (${getRiskLevelLabel(report.riskScore)})

<b>Findings:</b>
${findingsText}

<b>AI Summary & Recommendations:</b>
${report.summary}

<i>Report ID: ${report._id}</i>`;

    await ctx.reply(reportText, { parse_mode: "HTML" });
  } catch (error) {
    logger.error(`Error fetching report for job ${jobId}:`, error);
    await ctx.reply("⚠️ Failed to retrieve the report. Please try again later.");
  }
}

export default reportHandler;
