import { ConnectionOptions } from "bullmq";
import config from "./index";

export const redisConnection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  // Add fallback or custom config if required in the future
};

export default redisConnection;
