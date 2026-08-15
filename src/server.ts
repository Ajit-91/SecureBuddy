import express from "express";
import http from "http";
import config from "./config";
import logger from "./shared/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { bot } from "./bot";
import { webhookCallback } from "grammy";
import { resetAllUserCredits } from "./cron/resetCredits";
import { queueSandboxCleanup } from "./cron/cleanupSandboxes";
import { closeQueues } from "./queues";
import SandboxSession from "./models/SandboxSession";
import httpProxy from "http-proxy";

const app = express();
app.use(express.json());

const proxy = httpProxy.createProxyServer({ ws: true });

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// VNC Session Redirect Endpoint
app.get("/session/:token", async (req, res) => {
  const token = req.params.token;
  try {
    const session = await SandboxSession.findOne({
      sessionToken: token,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.status(404).send(
        `<h2>Session Expired or Not Found</h2>` +
          `<p>The interactive sandbox session has expired or does not exist.</p>`
      );
      return;
    }

    if (!session.port) {
      res.status(503).send(
        `<h2>Sandbox Initializing</h2>` +
          `<p>The sandbox container is still booting. Please refresh in a few seconds.</p>`
      );
      return;
    }

    res.redirect(`/sandbox/${token}/`);
  } catch (error) {
    logger.error(`Error redirecting session ${token}:`, error);
    res.status(500).send("<h2>Internal Server Error</h2>");
  }
});

// Proxy VNC HTTP requests
app.all("/sandbox/:token*", async (req, res) => {
  const token = (req.params as any).token;
  try {
    const session = await SandboxSession.findOne({
      sessionToken: token,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    if (!session || !session.port) {
      res.status(404).send(
        `<h2>Session Expired or Not Found</h2>` +
          `<p>The interactive sandbox session is no longer active.</p>`
      );
      return;
    }

    // Rewrite path to remove /sandbox/:token
    req.url = req.url.replace(/^\/sandbox\/[a-zA-Z0-9_-]+/, "");
    if (req.url === "") req.url = "/";

    proxy.web(req, res, { target: `http://127.0.0.1:${session.port}` }, (err) => {
      logger.error(`Proxy web error for session ${token}:`, err);
      if (!res.headersSent) {
        res.status(502).send("<h2>Proxy Error</h2><p>Failed to establish connection to the sandbox.</p>");
      }
    });
  } catch (error) {
    logger.error("Proxy middleware error:", error);
    res.status(500).send("<h2>Internal Server Error</h2>");
  }
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

// Secured System Endpoint for Sandbox Cleanup (triggered via external Scheduler)
app.post("/api/system/cleanup-sandboxes", async (req, res) => {
  const requestKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  const configKey = config.system.cronSecret;

  if (!configKey || requestKey !== configKey) {
    logger.warn("Unauthorized sandbox cleanup request attempted");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await queueSandboxCleanup();
    res.status(200).json({ success: true, message: "Sandbox cleanup job queued successfully" });
  } catch (error) {
    logger.error("Failed to execute sandbox cleanup trigger:", error);
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

    // Handle WebSocket proxying for VNC connections
    server.on("upgrade", async (req, socket, head) => {
      const match = req.url?.match(/^\/sandbox\/([a-zA-Z0-9_-]+)/);
      if (match) {
        const token = match[1];
        try {
          const session = await SandboxSession.findOne({
            sessionToken: token,
            status: "active",
            expiresAt: { $gt: new Date() },
          });

          if (session && session.port) {
            // Rewrite path to remove /sandbox/:token
            req.url = req.url!.replace(/^\/sandbox\/[a-zA-Z0-9_-]+/, "");
            if (req.url === "") req.url = "/";

            proxy.ws(req, socket, head, { target: `ws://127.0.0.1:${session.port}` }, (err) => {
              logger.error(`Proxy WS error for session ${token}:`, err);
            });
            return;
          }
        } catch (error) {
          logger.error("Proxy upgrade database query failed:", error);
        }
      }
      socket.destroy();
    });

    // 4. Start Bot in Polling/Webhook Mode
    if (config.bot.mode === "polling") {
      if (config.bot.token && config.bot.token !== "YOUR_TELEGRAM_BOT_TOKEN") {
        // Start polling asynchronously so it doesn't block server startup
        bot.start({
          allowed_updates: ["message", "callback_query"],
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
