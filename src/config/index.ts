import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  bot: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    mode: process.env.BOT_MODE || "polling", // polling or webhook
    appUrl: process.env.APP_URL || "",
  },
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/securebuddy",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  system: {
    cronSecret: process.env.RESET_CREDIT_CRON_SECRET || "",
  },
  sandbox: {
    expiryMinutes: parseInt(process.env.SANDBOX_EXPIRY_MINUTES || "60", 10),
  },
};

export default config;
