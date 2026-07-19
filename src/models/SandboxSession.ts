import { Schema, model, Document, Types } from "mongoose";

export interface ISandboxSession extends Document {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  containerId: string;
  sessionToken: string;
  expiresAt: Date;
  status: "active" | "expired" | "terminated";
  createdAt: Date;
  updatedAt: Date;
}

const SandboxSessionSchema = new Schema<ISandboxSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "AnalysisJob",
      required: true,
      index: true,
    },
    containerId: {
      type: String,
      required: true,
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "terminated"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SandboxSession = model<ISandboxSession>(
  "SandboxSession",
  SandboxSessionSchema
);
export default SandboxSession;
