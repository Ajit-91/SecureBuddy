import { BotContext } from "../../shared/types/telegram";
import AnalysisJob from "../../models/AnalysisJob";
import { initiateSandbox } from "../../services/sandbox.service";
import { escapeHtml } from "../../utils/escape";
import logger from "../../shared/logger";

/**
 * Handles the callback query for launching the sandbox.
 */
export async function sandboxHandler(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery?.data || "";
    const match = data.match(/^launch_sandbox:(.+)$/);
    if (!match) {
      await ctx.reply("⚠️ Invalid sandbox request.");
      return;
    }

    const jobId = match[1];
    
    // Fetch job to get type and target URL
    const job = await AnalysisJob.findById(jobId);
    if (!job) {
      await ctx.reply("❌ Analysis job not found. Sandbox cannot be created.");
      return;
    }

    // Security check: Make sure this job belongs to the current user
    if (job.userId.toString() !== ctx.dbUser!._id.toString()) {
      await ctx.reply("❌ You do not have permission to launch this sandbox.");
      return;
    }

    const targetValue = job.inputValue || job.displayName || "";
    if (!targetValue) {
      await ctx.reply("❌ Job input value is missing. Sandbox cannot be created.");
      return;
    }

    // Initiate the sandbox session (saves to DB and queues creation task)
    await initiateSandbox(
      String(ctx.dbUser!._id),
      job.type as "url" | "apk",
      targetValue,
      jobId
    );

    await ctx.reply(
      `⏳ <b>Initializing sandbox session...</b>\n\n` +
        `• <b>Target:</b> <code>${escapeHtml(targetValue)}</code>\n\n` +
        `We are booting up your secure container environment. You will receive a notification with the link once it is ready.`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error in sandbox callback query handler:", error);
    await ctx.reply("⚠️ Failed to initialize the sandbox session. Please try again later.");
  }
}

export default sandboxHandler;
