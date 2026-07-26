import { Bot } from "grammy";
import config from "../config";
import { BotContext } from "../shared/types/telegram";
import authMiddleware from "./middleware/auth";
import startHandler from "./handlers/start";
import helpHandler from "./handlers/help";
import creditsHandler from "./handlers/credits";
import { documentHandler } from "./handlers/document";
import urlHandler from "./handlers/url";
import historyHandler from "./handlers/history";
import reportHandler from "./handlers/report";
import sandboxHandler from "./handlers/sandbox";
import logger from "../shared/logger";

if (!config.bot.token || config.bot.token === "YOUR_TELEGRAM_BOT_TOKEN") {
  logger.warn("TELEGRAM_BOT_TOKEN is not configured or is set to placeholder. Bot features will be disabled until a valid token is set.");
}

export const bot = new Bot<BotContext>(
  config.bot.token || "dummy_token_for_compilation"
);

// Register middleware
bot.use(authMiddleware);

// Register commands
bot.command("start", startHandler);
bot.command("help", helpHandler);
bot.command("credits", creditsHandler);
bot.command("history", historyHandler);
bot.command("report", reportHandler);

// Register callback queries
bot.callbackQuery(/^launch_sandbox:(.+)$/, sandboxHandler);

// Content-based action routing
bot.on("message:document", documentHandler);
bot.on("message:text", urlHandler);

export default bot;
