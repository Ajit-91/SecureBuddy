import { Queue } from "bullmq";
import redisConnection from "../config/redis";
import { QUEUES, QueueName } from "../shared/constants/queues";
import logger from "../shared/logger";

// Initialize queues mapping
export const queues: Record<QueueName, Queue> = {
  [QUEUES.URL_ANALYSIS]: new Queue(QUEUES.URL_ANALYSIS, { connection: redisConnection }),
  [QUEUES.DOCUMENT_ANALYSIS]: new Queue(QUEUES.DOCUMENT_ANALYSIS, { connection: redisConnection }),
  [QUEUES.ZIP_ANALYSIS]: new Queue(QUEUES.ZIP_ANALYSIS, { connection: redisConnection }),
  [QUEUES.APK_ANALYSIS]: new Queue(QUEUES.APK_ANALYSIS, { connection: redisConnection }),
  [QUEUES.SANDBOX_CREATION]: new Queue(QUEUES.SANDBOX_CREATION, { connection: redisConnection }),
};

export async function addAnalysisJob(
  queueName: QueueName,
  jobId: string,
  data: {
    jobId: string;
    userId: string;
    type: string;
    inputValue?: string;
    telegramFileId?: string;
    originalFileName?: string;
  }
): Promise<void> {
  const queue = queues[queueName];
  if (!queue) {
    const errorMsg = `Queue ${queueName} not initialized`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(`Queueing job ${jobId} in queue [${queueName}]`);
  await queue.add("analyze", data, {
    jobId, // Use the DB's AnalysisJob ID as the BullMQ job ID
    removeOnComplete: true,
    removeOnFail: false,
  });
}

// Clean up connections on exit
export async function closeQueues(): Promise<void> {
  logger.info("Closing BullMQ queues...");
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
  logger.info("BullMQ queues closed successfully");
}
