import { BotContext } from "../../shared/types/telegram";
import logger from "../../shared/logger";

/**
 * Checks if the user has enough credits.
 * If yes, deducts 1 credit and returns true.
 * If no, replies with an error message and returns false.
 */
export async function checkAndDeductCredits(
  ctx: BotContext
): Promise<boolean> {
  const user = ctx.dbUser;
  if (!user) {
    await ctx.reply("⚠️ User profile not found. Please type `/start` to begin.");
    return false;
  }

  if (user.credits <= 0) {
    await ctx.reply(
      "❌ Insufficient credits. You have used all your 10 daily credits. Credits reset automatically at midnight."
    );
    return false;
  }

  // Deduct 1 credit immediately before job creation
  user.credits -= 1;
  await user.save();
  logger.info(`Deducted 1 credit from user ${user.telegramId}. Remaining credits: ${user.credits}`);
  return true;
}
