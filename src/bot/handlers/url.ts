import { BotContext } from "../../shared/types/telegram";
import { checkAndDeductCredits } from "../middleware/credits";
import AnalysisJobModel from "../../models/AnalysisJob";
import { addAnalysisJob } from "../../queues";
import { QUEUES } from "../../shared/constants/queues";
import { JOB_TYPES } from "../../shared/constants/jobTypes";
import logger from "../../shared/logger";
import { escapeHtml } from "../../utils/escape";

/**
 * Handles incoming text messages, detects URLs, and queues them for web analysis.
 */
export async function urlHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  // Regex to match a URL in the message
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);

  if (match) {
    const url = match[0];
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch (_) {}

    // Deduct credits
    const creditDeducted = await checkAndDeductCredits(ctx);
    if (!creditDeducted) return;

    try {
      // Create database job entry
      const job = await AnalysisJobModel.create({
        userId: ctx.dbUser!._id,
        type: JOB_TYPES.URL,
        status: "queued",
        displayName: hostname,
        inputValue: url,
      });

      // Queue BullMQ task
      await addAnalysisJob(QUEUES.URL_ANALYSIS, String(job._id), {
        jobId: String(job._id),
        userId: String(ctx.dbUser!._id),
        type: JOB_TYPES.URL,
        inputValue: url,
      });

      await ctx.reply(
        `🔗 <b>URL received and queued for analysis!</b>\n\n` +
          `• <b>Job ID:</b> <code>${job._id}</code>\n` +
          `• <b>Target:</b> <code>${escapeHtml(url)}</code>\n\n` +
          `Processing will begin shortly. You can check the status using <code>/report ${job._id}</code> later.`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      logger.error("Error creating URL job:", error);
      await ctx.reply("⚠️ Failed to queue the URL analysis. Please try again.");
    }
  } else {
    // If no URL is matched, suggest commands
    await ctx.reply("❓ I didn't recognize that input. Please send a URL link or upload a file. Use /help to see what I can do.");
  }
}

export default urlHandler;
