import { Schema, model, Document, Types } from "mongoose";
import { JobType } from "../shared/constants/jobTypes";

export interface IAnalysisJob extends Document {
  userId: Types.ObjectId;
  type: JobType;
  status: "queued" | "processing" | "completed" | "failed";
  displayName?: string;
  originalFileName?: string;
  telegramFileId?: string;
  inputValue?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisJobSchema = new Schema<IAnalysisJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["url", "pdf", "document", "zip", "apk"],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    displayName: {
      type: String,
    },
    originalFileName: {
      type: String,
    },
    telegramFileId: {
      type: String,
    },
    inputValue: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound or extra index if needed, but simple indexes on these fields are required
AnalysisJobSchema.index({ createdAt: -1 });

export const AnalysisJob = model<IAnalysisJob>("AnalysisJob", AnalysisJobSchema);
export default AnalysisJob;
