import fs from "fs";
import path from "path";
import logger from "../shared/logger";

const TEMP_BASE_DIR = path.resolve(process.cwd(), "temp");

/**
 * Creates a unique temporary directory for a specific analysis job.
 * @param jobId The database analysis job ID.
 * @returns The absolute path of the created directory.
 */
export function createJobTempDir(jobId: string): string {
  const dirPath = path.join(TEMP_BASE_DIR, jobId);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Recursively cleans up and deletes a job's temporary directory.
 * @param jobId The database analysis job ID.
 */
export function cleanupJobTempDir(jobId: string): void {
  const dirPath = path.join(TEMP_BASE_DIR, jobId);
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      logger.info(`Cleaned up temp directory for job: ${jobId}`);
    }
  } catch (error) {
    logger.error(`Failed to clean up temp directory for job ${jobId}:`, error);
  }
}
