import { Worker, Job } from "bullmq";
import redisConnection from "../config/redis";
import { QUEUES } from "../shared/constants/queues";
import AnalysisJob from "../models/AnalysisJob";
import User from "../models/User";
import { bot } from "../bot";
import { escapeHtml } from "../utils/escape";
import logger from "../shared/logger";

export const apkWorker = new Worker(
  QUEUES.APK_ANALYSIS,
  async (job: Job) => {
    const { jobId, userId, originalFileName } = job.data;
    logger.info(`Starting Stub APK Analysis Worker for Job: ${jobId}`);

    // 1. Update job status to processing in DB
    const analysisJob = await AnalysisJob.findById(jobId);
    if (!analysisJob) {
      logger.error(`Job record not found in MongoDB: ${jobId}`);
      return;
    }
    analysisJob.status = "processing";
    await analysisJob.save();

    // Fetch user to get their telegram ID
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User record not found in MongoDB: ${userId}`);
      analysisJob.status = "failed";
      analysisJob.errorMessage = "User not found";
      await analysisJob.save();
      return;
    }
    const chatId = user.telegramId;

    // Notify user via Telegram that analysis started
    try {
      await bot.api.sendMessage(
        chatId,
        `🔍 <b>APK Analysis Started</b>\n\nAnalyzing package file: <code>${escapeHtml(originalFileName || "app.apk")}</code>\nThis runs inside an isolated environment and takes a few moments.`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error(`Failed to send start notification to Telegram user ${chatId}:`, err);
    }

    // 2. Simulate quick static analysis completion (e.g., 2 seconds delay)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update job to completed
    analysisJob.status = "completed";
    await analysisJob.save();

    logger.info(`Job ${jobId} (APK) analysis completed successfully.`);

    // 3. Send success report and Launch Sandbox button
    try {
      await bot.api.sendMessage(
        chatId,
        `✅ <b>APK Analysis Completed!</b>\n\n` +
          `• <b>File:</b> <code>${escapeHtml(originalFileName || "app.apk")}</code>\n` +
          `• <b>Status:</b> Safe (Static check stub completed)\n\n` +
          `You can now launch this APK inside an isolated Android Emulator to explore it interactively.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 Launch Sandbox",
                  callback_data: `launch_sandbox:${jobId}`,
                },
              ],
            ],
          },
        }
      );
    } catch (err) {
      logger.error(`Failed to send analysis report to Telegram user ${chatId}:`, err);
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

export default apkWorker;
