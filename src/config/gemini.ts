import config from "./index";

export const geminiConfig = {
  apiKey: config.gemini.apiKey,
  defaultModel: "gemini-2.5-flash", // Default fallback model version from database-models.md
};

export default geminiConfig;
