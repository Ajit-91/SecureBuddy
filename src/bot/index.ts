import { Bot } from "grammy";
import config from "../config";
import { BotContext } from "../shared/types/telegram";
import authMiddleware from "./middleware/auth";
import { checkAndDeductCredits } from "./middleware/credits";
import startHandler from "./handlers/start";
import helpHandler from "./handlers/help";
import creditsHandler from "./handlers/credits";
import AnalysisJobModel from "../models/AnalysisJob";
import { addAnalysisJob } from "../queues";
import { QUEUES } from "../shared/constants/queues";
import { JOB_TYPES } from "../shared/constants/jobTypes";
import logger from "../shared/logger";

if (!config.bot.token || config.bot.token === "YOUR_TELEGRAM_BOT_TOKEN") {
  logger.warn("TELEGRAM_BOT_TOKEN is not configured or is set to placeholder. Bot features will be disabled until a valid token is set.");
}

export const bot = new Bot<BotContext>(
  config.bot.token || "dummy_token_for_compilation"
);

// Register middleware
bot.use(authMiddleware);

// Register commands
bot.command("start", startHandler);
bot.command("help", helpHandler);
bot.command("credits", creditsHandler);

// Fallback handlers for history and report (to be fully implemented in future phases)
bot.command("history", async (ctx) => {
  await ctx.reply("📜 *Analysis History* will be fully implemented in Phase 2.", { parse_mode: "Markdown" });
});

bot.command("report", async (ctx) => {
  // Try to parse jobId
  const text = ctx.match || "";
  if (!text.trim()) {
    await ctx.reply("⚠️ Please provide a job ID.\nExample: `/report <job_id>`", { parse_mode: "Markdown" });
    return;
  }
  await ctx.reply(`📊 *Report Details* for Job ID \`${text.trim()}\` will be fully implemented in Phase 2.`, { parse_mode: "Markdown" });
});

// Helper to determine file analysis type based on extension
function getFileType(fileName: string): "pdf" | "document" | "zip" | "apk" | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "txt") return "document";
  if (ext === "zip") return "zip";
  if (ext === "apk") return "apk";
  return null;
}

// Handler for document uploads
bot.on("message:document", async (ctx) => {
  const document = ctx.message.document;
  const fileName = document.file_name || "unnamed_file";
  const fileType = getFileType(fileName);

  if (!fileType) {
    await ctx.reply("❌ Unsupported file format. We support PDF, ZIP, APK, DOCX, and TXT files.");
    return;
  }

  // Deduct credits
  const creditDeducted = await checkAndDeductCredits(ctx);
  if (!creditDeducted) return;

  try {
    // Create database entry for the job
    const job = await AnalysisJobModel.create({
      userId: ctx.dbUser!._id,
      type: fileType,
      status: "queued",
      displayName: fileName,
      originalFileName: fileName,
      telegramFileId: document.file_id,
    });

    // Determine queue
    let queueName;
    if (fileType === "pdf" || fileType === "document") {
      queueName = QUEUES.DOCUMENT_ANALYSIS;
    } else if (fileType === "zip") {
      queueName = QUEUES.ZIP_ANALYSIS;
    } else {
      queueName = QUEUES.APK_ANALYSIS;
    }

    // Queue BullMQ task
    await addAnalysisJob(queueName, String(job._id), {
      jobId: String(job._id),
      userId: String(ctx.dbUser!._id),
      type: fileType,
      telegramFileId: document.file_id,
      originalFileName: fileName,
    });

    await ctx.reply(
      `📥 *File received and queued for analysis!*\n\n` +
        `• *Job ID:* \`${job._id}\`\n` +
        `• *File:* \`${fileName}\`\n` +
        `• *Type:* \`${fileType.toUpperCase()}\`\n\n` +
        `Processing will begin shortly. You can check the status using \`/report ${job._id}\` later.`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    logger.error("Error creating document job:", error);
    await ctx.reply("⚠️ Failed to queue the file analysis. Please try again.");
  }
});

// Handler for text messages (URLs or general chat)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
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
      // Create database job
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
        `🔗 *URL received and queued for analysis!*\n\n` +
          `• *Job ID:* \`${job._id}\`\n` +
          `• *Target:* \`${url}\`\n\n` +
          `Processing will begin shortly. You can check the status using \`/report ${job._id}\` later.`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error("Error creating URL job:", error);
      await ctx.reply("⚠️ Failed to queue the URL analysis. Please try again.");
    }
  } else {
    // If not a URL, suggest /help
    await ctx.reply("❓ I didn't recognize that input. Please send a URL link or upload a file. Use /help to see what I can do.");
  }
});

export default bot;
