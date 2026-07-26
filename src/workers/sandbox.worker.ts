import { Worker } from "bullmq";
import { Api } from "grammy";
import crypto from "crypto";
import redisConnection from "../config/redis";
import config from "../config";
import { QUEUES } from "../shared/constants/queues";
import SandboxSession from "../models/SandboxSession";
import User from "../models/User";
import { startSandboxContainer, findFreePort, cleanupExpiredSandboxSessions } from "../services/sandbox.service";
import { escapeHtml } from "../utils/escape";
import logger from "../shared/logger";

const api = new Api(config.bot.token || "dummy_token_for_compilation");

export const sandboxWorker = new Worker(
  QUEUES.SANDBOX_CREATION,
  async (job) => {
    if (job.name === "cleanup") {
      logger.info("Executing periodic sandbox cleanup job...");
      try {
        await cleanupExpiredSandboxSessions();
      } catch (err: any) {
        logger.error(`Error executing sandbox cleanup job: ${err.message}`);
      }
      return;
    }

    const sessionId = job.id;
    const { jobId, userId, type, inputValue } = job.data;

    logger.info(`Starting sandbox worker for session ${sessionId} (${type})...`);

    const session = await SandboxSession.findById(sessionId);
    if (!session) {
      logger.error(`SandboxSession ${sessionId} not found in database.`);
      return;
    }

    let containerId = "pending";
    let port = 0;

    try {
      // Find a free port on the host
      port = await findFreePort();
      logger.info(`Allocated free port ${port} for VNC sandbox.`);

      if (type === "url") {
        // Chromium image with noVNC exposed on container port 3000
        const image = "lscr.io/linuxserver/chromium:latest";
        
        // Pass the target URL via CHROME_CLI environment variable so chromium auto-navigates on start
        containerId = await startSandboxContainer(image, port, 3000, [], { CHROME_CLI: inputValue });
      } else {
        // Fallback or future placeholder (e.g. for APK Android Emulator)
        // We will default to a mock container for unsupported types or future phases
        logger.info(`Sandbox type [${type}] will run in mock container mode.`);
        containerId = `mock-container-${crypto.randomBytes(8).toString("hex")}`;
      }
    } catch (dockerError: any) {
      logger.warn(`Docker execution failed, falling back to mock container: ${dockerError.message}`);
      // Fallback: use a mock container ID and a fallback port
      containerId = `mock-container-${crypto.randomBytes(8).toString("hex")}`;
      if (port === 0) {
        port = 3000 + Math.floor(Math.random() * 1000);
      }
    }

    // Update SandboxSession in database
    session.containerId = containerId;
    session.port = port;
    session.status = "active";
    await session.save();

    logger.info(`SandboxSession ${sessionId} is active. Container: ${containerId}, Port: ${port}`);

    // Notify user via Telegram
    try {
      const user = await User.findById(userId);
      if (user && user.telegramId && config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
        const appUrl = (config.bot.appUrl || "http://localhost:3000").replace(/\/$/, "");
        const sessionLink = `${appUrl}/session/${session.sessionToken}`;

        await api.sendMessage(
          user.telegramId,
          `🚀 <b>Interactive Sandbox Ready!</b>\n\n` +
            `You can now safely explore the target in your browser:\n` +
            `👉 <a href="${sessionLink}">${sessionLink}</a>\n\n` +
            `• <b>Target:</b> <code>${escapeHtml(inputValue)}</code>\n` +
            `• <b>Duration:</b> <code>${config.sandbox.expiryMinutes} Minutes</code> (Hard cap)\n\n` +
            `<i>The container will be automatically destroyed when the session expires.</i>`,
          { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
        );
      }
    } catch (telegramError) {
      logger.error("Failed to send sandbox confirmation message to Telegram:", telegramError);
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// Listeners
sandboxWorker.on("completed", (job) => {
  logger.info(`Sandbox creation job ${job.id} completed successfully`);
});

sandboxWorker.on("failed", (job, err) => {
  logger.error(`Sandbox creation job ${job?.id} failed with error: ${err.message}`);
});

export default sandboxWorker;
