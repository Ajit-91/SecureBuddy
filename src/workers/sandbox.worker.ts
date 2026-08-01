import { Worker } from "bullmq";
import { Api } from "grammy";
import crypto from "crypto";
import https from "https";
import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import redisConnection from "../config/redis";
import config from "../config";
import { QUEUES } from "../shared/constants/queues";
import SandboxSession from "../models/SandboxSession";
import User from "../models/User";
import AnalysisJob from "../models/AnalysisJob";
import { startSandboxContainer, stopSandboxContainer, findFreePort, cleanupExpiredSandboxSessions } from "../services/sandbox.service";
import { createJobTempDir, cleanupJobTempDir } from "../utils/tempFiles";
import { escapeHtml } from "../utils/escape";
import logger from "../shared/logger";

const api = new Api(config.bot.token || "dummy_token_for_compilation");

// Helper function to download file from a URL
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file from ${url}, status code: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

// Helper function to poll and wait for Android Emulator to complete boot
function waitForEmulator(
  containerId: string,
  timeoutMs = 120000
): Promise<void> {
  const startTime = Date.now();
  let logCounter = 0;

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const elapsed = Math.round(
        (Date.now() - startTime) / 1000
      );

      logger.info(
        `[EMULATOR] Container=${containerId} Elapsed=${elapsed}s`
      );

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);

        logger.error(
          `[EMULATOR] Boot timeout after ${elapsed}s`
        );

        exec(
          `docker logs ${containerId} --tail 200`,
          (_, stdout, stderr) => {
            logger.error(
              `[EMULATOR] Final Container Logs:\n${stdout}`
            );

            if (stderr) {
              logger.error(
                `[EMULATOR] Final Container Errors:\n${stderr}`
              );
            }
          }
        );

        reject(
          new Error(
            "Timeout waiting for Android Emulator boot completion."
          )
        );

        return;
      }

      exec(
        `docker exec ${containerId} adb devices`,
        (_, stdout, stderr) => {
          logger.info(
            `[ADB DEVICES]\n${stdout}`
          );

          if (stderr) {
            logger.warn(
              `[ADB STDERR]\n${stderr}`
            );
          }
        }
      );

      exec(
        `docker exec ${containerId} adb shell getprop sys.boot_completed`,
        (error, stdout, stderr) => {
          if (stderr) {
            logger.warn(
              `[BOOT CHECK STDERR] ${stderr}`
            );
          }

          logger.info(
            `[BOOT CHECK] sys.boot_completed="${stdout.trim()}"`
          );

          if (
            !error &&
            stdout.trim() === "1"
          ) {
            clearInterval(checkInterval);

            logger.info(
              `Android Emulator ${containerId} booted successfully after ${elapsed}s`
            );

            resolve();
          }
        }
      );

      logCounter++;

      if (logCounter % 6 === 0) {
        exec(
          `docker logs ${containerId} --tail 100`,
          (_, stdout, stderr) => {
            logger.info(
              `[CONTAINER LOGS]\n${stdout}`
            );

            if (stderr) {
              logger.warn(
                `[CONTAINER STDERR]\n${stderr}`
              );
            }
          }
        );
      }
    }, 5000);
  });
}

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
      } else if (type === "apk") {
        if (!session.jobId) {
          throw new Error("Sandbox session does not contain a valid jobId.");
        }
        const jobRecord = await AnalysisJob.findById(session.jobId);
        if (!jobRecord || !jobRecord.telegramFileId) {
          throw new Error(`AnalysisJob record or telegramFileId not found for Job ID ${session.jobId}`);
        }

        // 1. Create a job temp directory
        const tempDir = createJobTempDir(String(session.jobId));
        const localApkPath = path.join(tempDir, "app.apk");

        // 2. Fetch the file path from Telegram and download the file
        logger.info(`Fetching APK file path from Telegram for File ID: ${jobRecord.telegramFileId}`);
        const fileInfo = await api.getFile(jobRecord.telegramFileId);
        if (!fileInfo.file_path) {
          throw new Error(`Telegram API returned empty file_path for File ID ${jobRecord.telegramFileId}`);
        }
        const fileDownloadUrl = `https://api.telegram.org/file/bot${config.bot.token}/${fileInfo.file_path}`;

        logger.info(`Downloading APK file from Telegram...`);
        await downloadFile(fileDownloadUrl, localApkPath);
        logger.info(`APK downloaded successfully to ${localApkPath}`);

        // 3. Determine KVM vs Privileged mode
        let extraFlags: string[] = [];
        let emulatorArgs = "-no-audio -no-boot-anim";
        let hasKvm = false;
        try {
          execSync("docker run --rm --device /dev/kvm alpine ls /dev/kvm", { stdio: "ignore" });
          hasKvm = true;
        } catch (e) {
          hasKvm = false;
        }

        logger.info(
          `Host KVM available: ${hasKvm}`
        );

        if (hasKvm) {
          logger.info("KVM device found on host. Exposing /dev/kvm to Android Emulator...");
          extraFlags.push("--device /dev/kvm", "--cap-add SYS_ADMIN");
        } else {
          logger.warn("KVM device not found. Running Android Emulator container in software rendering mode...");
          extraFlags.push("--privileged");
          emulatorArgs = "-no-accel -gpu swiftshader_indirect -no-audio -no-boot-anim";
        }

        // 4. Start the Android Emulator Container
        const image = "budtmo/docker-android:emulator_9.0";
        logger.info(`Spawning Android Emulator container on port ${port}...`);

        containerId = await startSandboxContainer(
          image,
          port,
          6080,
          [],
          {
            EMULATOR_DEVICE: "Samsung Galaxy S6",
            WEB_VNC: "true",
            WEB_VNC_PORT: "6080",
            EMULATOR_ARGS: emulatorArgs
          },
          extraFlags
        );

        logger.info(
          `Android Emulator container started. ID=${containerId}`
        );

        exec(
          `docker ps -a | grep ${containerId}`,
          (_, stdout) => {
            logger.info(
              `[DOCKER STATUS]\n${stdout}`
            );
          }
        );

        exec(
          `docker inspect ${containerId}`,
          (_, stdout) => {
            logger.info(
              `[DOCKER INSPECT]\n${stdout}`
            );
          }
        );

        // 5. Wait for emulator to complete boot
        logger.info(`Waiting for emulator to boot inside container ${containerId}...`);
        await waitForEmulator(containerId, 300000);

        // 6. Install the APK
        logger.info(`Copying APK into emulator container...`);
        await new Promise<void>((resolve, reject) => {
          exec(`docker cp "${localApkPath}" ${containerId}:/tmp/app.apk`, (error) => {
            if (error) reject(new Error(`Failed to copy APK to container: ${error.message}`));
            else resolve();
          });
        });

        logger.info(`Installing APK inside emulator...`);

        await new Promise<void>((resolve, reject) => {
          // Log connected devices before installation
          exec(
            `docker exec ${containerId} adb devices`,
            (_, stdout, stderr) => {
              logger.info(`[ADB BEFORE INSTALL]\n${stdout}`);

              if (stderr) {
                logger.warn(`[ADB BEFORE INSTALL STDERR]\n${stderr}`);
              }
            }
          );

          // Install APK
          exec(
            `docker exec ${containerId} adb install -r /tmp/app.apk`,
            (error, stdout, stderr) => {
              logger.info(`[APK INSTALL STDOUT]\n${stdout}`);

              if (stderr) {
                logger.warn(`[APK INSTALL STDERR]\n${stderr}`);
              }

              if (error) {
                reject(
                  new Error(
                    `Failed to install APK: ${error.message}`
                  )
                );
              } else {
                resolve();
              }
            }
          );
        });

        // 7. Clean up local temp folder
        cleanupJobTempDir(String(session.jobId));
      } else {
        logger.info(`Sandbox type [${type}] is not supported.`);
        throw new Error(`Unsupported sandbox type: ${type}`);
      }
    } catch (dockerError: any) {
      logger.error(`Sandbox worker execution failed: ${dockerError.message}`);
      if (containerId !== "pending" && !containerId.startsWith("mock-")) {
        logger.info(`Cleaning up failed container: ${containerId}`);
        await stopSandboxContainer(containerId);
      }

      session.status = "terminated";
      await session.save();

      // Notify user of the failure
      try {
        const user = await User.findById(userId);
        if (user && user.telegramId && config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
          let errorDetails = "An internal error occurred while setting up the sandbox environment. Please contact the administrator.";
          if (dockerError.message.includes("file is too big")) {
            errorDetails = "The uploaded APK exceeds Telegram's 20MB download limit for standard bots. Please try a smaller APK (under 20MB) or configure a local Telegram Bot API Server.";
          }
          await api.sendMessage(
            user.telegramId,
            `❌ <b>Sandbox Launch Failed</b>\n\n` +
            `We could not boot your secure container environment.\n\n` +
            `• <b>Reason:</b> <code>${escapeHtml(errorDetails)}</code>`,
            { parse_mode: "HTML" }
          );
        }
      } catch (telegramError) {
        logger.error("Failed to send sandbox failure message to Telegram:", telegramError);
      }
      return;
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
