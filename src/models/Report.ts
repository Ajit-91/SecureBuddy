import { Schema, model, Document, Types } from "mongoose";

export interface IReport extends Document {
  jobId: Types.ObjectId;
  riskScore: number;
  summary: string;
  findings: any[];
  reportData: any;
  aiProvider: string;
  aiModelVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "AnalysisJob",
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    findings: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    reportData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    aiProvider: {
      type: String,
      required: true,
    },
    aiModelVersion: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

ReportSchema.index({ createdAt: -1 });

export const Report = model<IReport>("Report", ReportSchema);
export default Report;
