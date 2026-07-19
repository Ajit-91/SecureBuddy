import User from "../models/User";
import logger from "../shared/logger";

/**
 * Resets the credits of all users back to 10.
 * @returns The number of user profiles updated.
 */
export async function resetAllUserCredits(): Promise<number> {
  logger.info("Executing user credits reset database query...");
  try {
    const result = await User.updateMany(
      {},
      {
        $set: {
          credits: 10,
        },
      }
    );
    logger.info(`Successfully reset credits for ${result.modifiedCount} user records.`);
    return result.modifiedCount;
  } catch (error) {
    logger.error("Failed to reset user credits in database:", error);
    throw error;
  }
}
