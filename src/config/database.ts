import mongoose from "mongoose";
import config from "./index";
import logger from "../shared/logger";

export async function connectDatabase(): Promise<void> {
  try {
    const options = {
      autoIndex: true, // Build indexes
    };

    mongoose.connection.on("connected", () => {
      logger.info("MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    await mongoose.connect(config.mongo.uri, options);
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected successfully");
}
