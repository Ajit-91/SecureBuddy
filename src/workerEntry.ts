import { connectDatabase, disconnectDatabase } from "./config/database";
import { urlWorker } from "./workers/url.worker";
import { closeQueues } from "./queues";
import logger from "./shared/logger";

async function startWorkerProcess() {
  logger.info("Starting SecureBuddy Worker Process...");
  try {
    // 1. Connect to Database
    await connectDatabase();
    logger.info("Worker DB connection initialized successfully.");

    // 2. Importing worker triggers BullMQ listener to start
    logger.info(`Active Workers listening: [${urlWorker.name}]`);

    // Handle graceful shutdown signals
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down worker process...`);
      try {
        logger.info("Closing workers...");
        await urlWorker.close();
        
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
