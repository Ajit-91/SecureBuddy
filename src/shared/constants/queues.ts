export const QUEUES = {
  URL_ANALYSIS: "url-analysis",
  DOCUMENT_ANALYSIS: "document-analysis",
  ZIP_ANALYSIS: "zip-analysis",
  APK_ANALYSIS: "apk-analysis",
  SANDBOX_CREATION: "sandbox-creation",
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];
