import { queues } from "../queues";
import { QUEUES } from "../shared/constants/queues";
import logger from "../shared/logger";

/**
 * Queues a sandbox cleanup job in the sandbox-creation queue.
 */
export async function queueSandboxCleanup(): Promise<void> {
  logger.info("Executing sandbox cleanup cron trigger...");
  try {
    const queue = queues[QUEUES.SANDBOX_CREATION];
    if (!queue) {
      const errorMsg = "Sandbox creation queue not initialized";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Add a cleanup job to the sandbox queue
    await queue.add("cleanup", {}, {
      removeOnComplete: true,
      removeOnFail: true,
    });

    logger.info("Successfully queued sandbox cleanup job in BullMQ.");
  } catch (error) {
    logger.error("Failed to queue sandbox cleanup job:", error);
    throw error;
  }
}
