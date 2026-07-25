import express from "express";
import http from "http";
import config from "./config";
import logger from "./shared/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { bot } from "./bot";
import { webhookCallback } from "grammy";
import { resetAllUserCredits } from "./cron/resetCredits";
import { closeQueues } from "./queues";

const app = express();
app.use(express.json());

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

app.get("/", (req, res) => {
  res.status(200).send("SecureBuddy API Server");
});

// Configure Bot Delivery Mode
if (config.bot.mode === "webhook" && config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
  logger.info("Configuring Bot in Webhook mode...");
  app.use(`/bot${config.bot.token}`, webhookCallback(bot, "express"));
}

// Secured System Endpoint for Credits Reset (triggered via external Scheduler)
app.post("/api/system/reset-credits", async (req, res) => {
  const requestKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  const configKey = config.system.cronSecret;

  if (!configKey || requestKey !== configKey) {
    logger.warn("Unauthorized credits reset request attempted");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const updatedCount = await resetAllUserCredits();
    res.status(200).json({ success: true, updatedCount });
  } catch (error) {
    logger.error("Failed to execute credits reset endpoint:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

let server: http.Server;

async function startServer() {
  try {
    // 1. Connect to Database
    await connectDatabase();

    // 2. Start Express server
    server = app.listen(config.port, () => {
      logger.info(`SecureBuddy API Server running on port ${config.port} in [${config.nodeEnv}] mode`);
    });

    // 4. Start Bot in Polling/Webhook Mode
    if (config.bot.mode === "polling") {
      if (config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
        // Start polling asynchronously so it doesn't block server startup
        bot.start({
          allowed_updates: ["message"],
          onStart: (botInfo) => {
            logger.info(`Grammy Bot @${botInfo.username} started successfully via long polling`);
          },
        }).catch((err) => {
          logger.error("Error running Grammy bot polling:", err);
        });
      } else {
        logger.warn("Telegram bot token not provided or is placeholder. Long polling disabled.");
      }
    } else if (config.bot.mode === "webhook") {
      if (config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
        if (config.bot.appUrl) {
          try {
            const webhookUrl = `${config.bot.appUrl.replace(/\/$/, "")}/bot${config.bot.token}`;
            logger.info(`Setting Telegram Webhook to: ${webhookUrl}`);
            await bot.api.setWebhook(webhookUrl);
            logger.info("Telegram Webhook set successfully.");
          } catch (err) {
            logger.error("Failed to set Telegram Webhook:", err);
          }
        } else {
          logger.warn("BOT_MODE is webhook but APP_URL is not configured. Webhook registration skipped.");
        }
      }
    }
  } catch (error) {
    logger.error("Failed to start SecureBuddy API Server:", error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      logger.info("Express HTTP server closed.");
    });
  }

  try {
    // Stop Telegram bot if running
    if (bot.isInited()) {
      logger.info("Stopping Telegram Bot...");
      await bot.stop();
      logger.info("Telegram Bot stopped.");
    }

    // Close BullMQ queues
    await closeQueues();

    // Disconnect Mongoose
    await disconnectDatabase();

    logger.info("Shutdown completed successfully.");
    process.exit(0);
  } catch (error) {
    logger.error("Error occurred during graceful shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Start the server
startServer();
