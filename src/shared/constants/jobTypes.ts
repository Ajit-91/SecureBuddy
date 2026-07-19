export const JOB_TYPES = {
  URL: "url",
  PDF: "pdf",
  DOCUMENT: "document",
  ZIP: "zip",
  APK: "apk",
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];
