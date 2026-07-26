import { BotContext } from "../../shared/types/telegram";
import AnalysisJob from "../../models/AnalysisJob";
import Report from "../../models/Report";
import { escapeHtml } from "../../utils/escape";
import logger from "../../shared/logger";

/**
 * Handles the /history command, returning the last 10 analysis jobs for the user.
 */
export async function historyHandler(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply("⚠️ User profile not found. Please run /start first.");
    return;
  }

  try {
    const jobs = await AnalysisJob.find({ userId: ctx.dbUser._id })
      .sort({ createdAt: -1 })
      .limit(10);

    if (jobs.length === 0) {
      await ctx.reply("📜 <b>Analysis History</b> is empty. Send a URL or upload a file to start!", {
        parse_mode: "HTML",
      });
      return;
    }

    const jobIds = jobs.map((job) => job._id);
    const reports = await Report.find({ jobId: { $in: jobIds } });
    const reportMap = new Map(reports.map((r) => [r.jobId.toString(), r]));

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let responseText = "📜 <b>Analysis History</b>\n\n";

    jobs.forEach((job, index) => {
      const date = new Date(job.createdAt);
      const dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
      const name = job.displayName || job.originalFileName || job.inputValue || "Unknown";
      
      responseText += `${index + 1}. <b>${escapeHtml(name)}</b>\n`;
      if (job.status === "completed") {
        const report = reportMap.get(job._id.toString());
        const riskScore = report ? report.riskScore : "N/A";
        responseText += `   Risk: <code>${riskScore}</code>\n`;
      } else {
        const statusLabel = job.status.charAt(0).toUpperCase() + job.status.slice(1);
        responseText += `   Status: <code>${statusLabel}</code>\n`;
      }
      responseText += `   Date: <code>${dateStr}</code>\n`;
      responseText += `   Job ID: <code>${job._id}</code>\n\n`;
    });

    responseText += `Use <code>/report &lt;jobId&gt;</code> to view full report details.`;

    await ctx.reply(responseText, { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Error retrieving analysis history:", error);
    await ctx.reply("⚠️ Failed to retrieve analysis history. Please try again.");
  }
}

export default historyHandler;
