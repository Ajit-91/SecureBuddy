import crypto from "crypto";
import { exec } from "child_process";
import net from "net";
import { Api } from "grammy";
import config from "../config";
import SandboxSession, { ISandboxSession } from "../models/SandboxSession";
import User from "../models/User";
import { addAnalysisJob } from "../queues";
import { QUEUES } from "../shared/constants/queues";
import { escapeHtml } from "../utils/escape";
import logger from "../shared/logger";

const api = new Api(config.bot.token || "dummy_token_for_compilation");

/**
 * Initiates a new sandbox session by saving a pending record in MongoDB and queueing the Docker creation.
 */
export async function initiateSandbox(
  userId: string,
  type: "url" | "apk",
  targetValue: string,
  jobId?: string
): Promise<ISandboxSession> {
  const sessionToken = crypto.randomBytes(16).toString("hex");
  const expiryMinutes = config.sandbox.expiryMinutes;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const session = await SandboxSession.create({
    userId,
    jobId,
    containerId: "pending",
    targetValue,
    sessionToken,
    expiresAt,
    status: "active",
  });

  logger.info(`Created pending sandbox session ${session._id} for user ${userId}. Queueing...`);

  await addAnalysisJob(QUEUES.SANDBOX_CREATION, String(session._id), {
    jobId: jobId || "",
    userId,
    type,
    inputValue: targetValue,
  });

  return session;
}

/**
 * Runs a Docker container in the background.
 */
export async function startSandboxContainer(
  image: string,
  hostPort: number,
  containerPort: number,
  args: string[] = [],
  env: Record<string, string> = {},
  extraFlags: string[] = []
): Promise<string> {
  const envFlags = Object.entries(env)
    .map(([key, val]) => `-e ${key}="${val.replace(/"/g, '\\"')}"`)
    .join(" ");
  
  const resourceFlags = [
    `--cpus="${config.sandbox.cpuLimit}"`,
    `-m "${config.sandbox.memoryLimit}"`,
    `--network "${config.sandbox.networkMode}"`,
  ];

  const allFlags = [...resourceFlags, ...extraFlags].join(" ");
  const escapedArgs = args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
  const command = `docker run -d --rm -p ${hostPort}:${containerPort} ${allFlags} ${envFlags} ${image} ${escapedArgs}`.trim().replace(/\s+/g, " ");
  logger.info(`Spawning background container: ${command}`);

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Failed to start background container: ${error.message}`);
        reject(error);
      } else {
        const containerId = stdout.trim();
        logger.info(`Container started successfully: ${containerId}`);
        resolve(containerId);
      }
    });
  });
}

/**
 * Stops a running Docker container.
 */
export async function stopSandboxContainer(containerId: string): Promise<void> {
  if (!containerId || containerId === "pending" || containerId.startsWith("mock-")) {
    logger.info(`Skipping container stop for invalid/mock container ID: ${containerId}`);
    return;
  }
  const command = `docker stop ${containerId}`;
  logger.info(`Stopping container: ${command}`);
  return new Promise((resolve) => {
    exec(command, (error) => {
      if (error) {
        logger.warn(`Failed to stop container ${containerId}: ${error.message}`);
      } else {
        logger.info(`Container ${containerId} stopped successfully.`);
      }
      resolve();
    });
  });
}

/**
 * Searches for a free port on the host system.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Periodically called to clean up expired sandbox sessions.
 */
export async function cleanupExpiredSandboxSessions(): Promise<void> {
  logger.debug("Checking for expired sandbox sessions...");
  try {
    const expiredSessions = await SandboxSession.find({
      status: "active",
      expiresAt: { $lte: new Date() },
    });

    if (expiredSessions.length === 0) {
      return;
    }

    logger.info(`Found ${expiredSessions.length} expired sandbox sessions. Starting cleanup...`);

    for (const session of expiredSessions) {
      try {
        await stopSandboxContainer(session.containerId);

        session.status = "expired";
        await session.save();
        logger.info(`Session ${session._id} marked as expired.`);

        const user = await User.findById(session.userId);
        if (user && user.telegramId && config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
          await api.sendMessage(
            user.telegramId,
            `⚠️ <b>Sandbox Session Expired</b>\n\nYour interactive sandbox session for <code>${escapeHtml(session.targetValue)}</code> has expired and the container has been terminated.`,
            { parse_mode: "HTML" }
          );
        }
      } catch (err: any) {
        logger.error(`Error cleaning up expired session ${session._id}:`, err);
      }
    }
  } catch (error) {
    logger.error("Failed to fetch/cleanup expired sandbox sessions:", error);
  }
}
