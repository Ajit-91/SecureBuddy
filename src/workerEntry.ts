import config from "./config";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { urlWorker } from "./workers/url.worker";
import { sandboxWorker } from "./workers/sandbox.worker";
import { apkWorker } from "./workers/apk.worker";
import { cleanupExpiredSandboxSessions } from "./services/sandbox.service";
import { closeQueues } from "./queues";
import logger from "./shared/logger";

async function startWorkerProcess() {
  logger.info("Starting SecureBuddy Worker Process...");
  try {
    // 1. Connect to Database
    await connectDatabase();
    logger.info("Worker DB connection initialized successfully.");

    // 2. Importing worker triggers BullMQ listener to start
    logger.info(`Active Workers listening: [${urlWorker.name}, ${sandboxWorker.name}, ${apkWorker.name}]`);

    // 3. Start periodic expired sandbox session cleanup (every 60 seconds) in development environment
    let cleanupInterval: NodeJS.Timeout | undefined;
    if (config.nodeEnv !== "production") {
      logger.info("Initializing local sandbox cleanup interval (Development mode)...");
      cleanupInterval = setInterval(async () => {
        try {
          await cleanupExpiredSandboxSessions();
        } catch (err) {
          logger.error("Error running sandbox cleanup interval:", err);
        }
      }, 60000);
    } else {
      logger.info("Local sandbox cleanup interval disabled (Production mode). Sandbox cleanup will be triggered externally via HTTP cron endpoint.");
    }

    // Handle graceful shutdown signals
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down worker process...`);
      try {
        logger.info("Closing workers...");
        if (cleanupInterval) clearInterval(cleanupInterval);
        await urlWorker.close();
        await sandboxWorker.close();
        await apkWorker.close();
        
        logger.info("Closing queues...");
        await closeQueues();

        logger.info("Disconnecting database...");
        await disconnectDatabase();

        logger.info("Worker process terminated cleanly.");
        process.exit(0);
      } catch (err) {
        logger.error("Error during worker shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

  } catch (error) {
    logger.error("Failed to boot worker process:", error);
    process.exit(1);
  }
}

startWorkerProcess();
