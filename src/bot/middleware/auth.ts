import { NextFunction } from "grammy";
import { BotContext } from "../../shared/types/telegram";
import User from "../../models/User";
import logger from "../../shared/logger";

export async function authMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  try {
    if (!ctx.from) {
      return await next();
    }

    const telegramId = String(ctx.from.id);
    let user = await User.findOne({ telegramId });

    if (!user) {
      logger.info(`Auto-creating new user profile for telegramId: ${telegramId}`);
      user = await User.create({
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        credits: 10,
        plan: "free",
      });
    } else {
      // Keep username, first name, last name updated
      let needsSave = false;
      if (user.username !== ctx.from.username) {
        user.username = ctx.from.username;
        needsSave = true;
      }
      if (user.firstName !== ctx.from.first_name) {
        user.firstName = ctx.from.first_name;
        needsSave = true;
      }
      if (user.lastName !== ctx.from.last_name) {
        user.lastName = ctx.from.last_name;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    ctx.dbUser = user;
    await next();
  } catch (error) {
    logger.error("Error in authMiddleware:", error);
    await ctx.reply("⚠️ An internal authentication error occurred. Please try again later.");
  }
}

export default authMiddleware;
