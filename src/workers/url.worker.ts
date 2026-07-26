import { Worker, Job } from "bullmq";
import path from "path";
import fs from "fs";
import { InputFile } from "grammy";
import redisConnection from "../config/redis";
import { QUEUES } from "../shared/constants/queues";
import AnalysisJob from "../models/AnalysisJob";
import User from "../models/User";
import Report from "../models/Report";
import { bot } from "../bot";
import { runDockerContainer } from "../services/docker.service";
import { generateAiSummary } from "../services/gemini.service";
import { createJobTempDir, cleanupJobTempDir } from "../utils/tempFiles";
import { analyzeUrlRisk } from "../utils/riskScore";
import { getRiskLevelLabel } from "../shared/constants/riskLevels";
import { escapeHtml } from "../utils/escape";
import logger from "../shared/logger";

export const urlWorker = new Worker(
  QUEUES.URL_ANALYSIS,
  async (job: Job) => {
    const { jobId, userId, inputValue: url } = job.data;
    logger.info(`Starting URL Analysis Worker for Job: ${jobId}, target URL: ${url}`);

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

    // Notify user via Telegram
    try {
      await bot.api.sendMessage(
        chatId,
        `🔍 <b>URL Analysis Started</b>\n\nAnalyzing site: <code>${escapeHtml(url)}</code>\nThis runs inside an isolated container and takes a few moments.`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error(`Failed to send start notification to Telegram user ${chatId}:`, err);
    }

    // 2. Setup job-specific host temporary folder
    const tempDir = createJobTempDir(jobId);
    const resultJsonPath = path.join(tempDir, "result.json");
    const screenshotPath = path.join(tempDir, "screenshot.png");

    try {
      // 3. Spawns secure docker playwright container
      logger.info(`Running Playwright container for URL: ${url}`);
      await runDockerContainer(
        "securebuddy-url-analyzer",
        [url, "/app/output"],
        [{ hostPath: tempDir, containerPath: "/app/output" }]
      );

      // 4. Verify results generated in temp folder
      if (!fs.existsSync(resultJsonPath)) {
        throw new Error("Analyzer did not output result.json file.");
      }

      const rawResult = fs.readFileSync(resultJsonPath, "utf-8");
      const scanResult = JSON.parse(rawResult);

      if (scanResult.status === "error") {
        throw new Error(scanResult.errorMessage || "Scan error reported inside container.");
      }

      const { finalUrl, redirectChain, metadata } = scanResult;

      // 5. Run deterministic security checks
      const { riskScore, findings } = analyzeUrlRisk(url, finalUrl, redirectChain);

      // 6. Generate AI Summary report
      const summary = await generateAiSummary({
        url,
        finalUrl,
        redirectChain,
        metadata,
        findings,
      });

      // 7. Store Report in MongoDB
      const report = await Report.create({
        jobId: analysisJob._id,
        riskScore,
        summary,
        findings,
        reportData: {
          initialUrl: url,
          finalUrl,
          redirectChain,
          metadata,
        },
        aiProvider: "gemini",
        aiModelVersion: "gemini-2.5-flash",
      });

      // Update AnalysisJob to completed
      analysisJob.status = "completed";
      await analysisJob.save();

      // 8. Send report details and screenshot back to user
      const escapedUrl = escapeHtml(url);
      const escapedFinalUrl = escapeHtml(finalUrl);
      const escapedSummary = escapeHtml(summary);

      const findingsText =
        findings.length > 0
          ? findings
              .map((f) => `• [${f.severity.toUpperCase()}] <b>${escapeHtml(f.title)}</b>: ${escapeHtml(f.description)}`)
              .join("\n")
          : "• No immediate security risks detected.";

      const reportText = `🛡️ <b>SecureBuddy URL Security Report</b>

<b>Target URL:</b> <code>${escapedUrl}</code>
<b>Landed URL:</b> <code>${escapedFinalUrl}</code>

<b>Risk Score:</b> <b>${riskScore} / 100</b> (${getRiskLevelLabel(riskScore)})

<b>Findings:</b>
${findingsText}

<b>AI Summary & Recommendations:</b>
${escapedSummary}

<i>Report ID: ${report._id}</i>`;

      // Upload screenshot to Telegram if generated, otherwise send text report
      if (fs.existsSync(screenshotPath)) {
        logger.info(`Uploading screenshot for job ${jobId} to Telegram...`);
        await bot.api.sendPhoto(chatId, new InputFile(screenshotPath), {
          caption: reportText.substring(0, 1024), // Telegram caption limit is 1024 characters
          parse_mode: "HTML",
        });

        // If the report text exceeded caption limit, send remainder as a separate message
        if (reportText.length > 1024) {
          await bot.api.sendMessage(chatId, reportText, { parse_mode: "HTML" });
        }
      } else {
        logger.warn(`No screenshot found at ${screenshotPath}. Sending text report only.`);
        await bot.api.sendMessage(chatId, reportText, { parse_mode: "HTML" });
      }

    } catch (error: any) {
      logger.error(`URL Analysis failed for job ${jobId}:`, error.message);
      
      analysisJob.status = "failed";
      analysisJob.errorMessage = error.message;
      await analysisJob.save();

      try {
        await bot.api.sendMessage(
          chatId,
          `❌ <b>URL Analysis Failed</b>\n\nFailed to scan: <code>${escapeHtml(url)}</code>\n<b>Error:</b> ${escapeHtml(error.message)}`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        logger.error("Failed to send error message to Telegram:", err);
      }
    } finally {
      // 9. Clean up temp files recursively
      cleanupJobTempDir(jobId);
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Allow processing up to 2 URLs concurrently
  }
);

// Graceful shut down listener
urlWorker.on("completed", (job) => {
  logger.info(`URL Analysis Job ${job.id} completed successfully`);
});

urlWorker.on("failed", (job, err) => {
  logger.error(`URL Analysis Job ${job?.id} failed with error: ${err.message}`);
});
export default urlWorker;
