import { BotContext } from "../../shared/types/telegram";
import { checkAndDeductCredits } from "../middleware/credits";
import AnalysisJobModel from "../../models/AnalysisJob";
import { addAnalysisJob } from "../../queues";
import { QUEUES } from "../../shared/constants/queues";
import logger from "../../shared/logger";
import { escapeHtml } from "../../utils/escape";

// Helper to determine file analysis type based on extension
function getFileType(fileName: string): "pdf" | "document" | "zip" | "apk" | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "txt") return "document";
  if (ext === "zip") return "zip";
  if (ext === "apk") return "apk";
  return null;
}

/**
 * Handles incoming document uploads (PDF, ZIP, APK, DOCX, TXT) from Telegram users.
 */
export async function documentHandler(ctx: BotContext): Promise<void> {
  const document = ctx.message?.document;
  if (!document) return;

  const fileName = document.file_name || "unnamed_file";
  const fileType = getFileType(fileName);

  if (!fileType) {
    await ctx.reply("❌ Unsupported file format. We support PDF, ZIP, APK, DOCX, and TXT files.");
    return;
  }

  // Deduct credits
  const creditDeducted = await checkAndDeductCredits(ctx);
  if (!creditDeducted) return;

  try {
    // Create database entry for the job
    const job = await AnalysisJobModel.create({
      userId: ctx.dbUser!._id,
      type: fileType,
      status: "queued",
      displayName: fileName,
      originalFileName: fileName,
      telegramFileId: document.file_id,
    });

    // Determine queue
    let queueName;
    if (fileType === "pdf" || fileType === "document") {
      queueName = QUEUES.DOCUMENT_ANALYSIS;
    } else if (fileType === "zip") {
      queueName = QUEUES.ZIP_ANALYSIS;
    } else {
      queueName = QUEUES.APK_ANALYSIS;
    }

    // Queue BullMQ task
    await addAnalysisJob(queueName, String(job._id), {
      jobId: String(job._id),
      userId: String(ctx.dbUser!._id),
      type: fileType,
      telegramFileId: document.file_id,
      originalFileName: fileName,
    });

    await ctx.reply(
      `📥 <b>File received and queued for analysis!</b>\n\n` +
        `• <b>Job ID:</b> <code>${job._id}</code>\n` +
        `• <b>File:</b> <code>${escapeHtml(fileName)}</code>\n` +
        `• <b>Type:</b> <code>${fileType.toUpperCase()}</code>\n\n` +
        `Processing will begin shortly. You can check the status using <code>/report ${job._id}</code> later.`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error("Error creating document job:", error);
    await ctx.reply("⚠️ Failed to queue the file analysis. Please try again.");
  }
}


