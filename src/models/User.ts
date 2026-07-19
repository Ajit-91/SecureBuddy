import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  credits: number;
  plan: "free" | "premium";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    credits: {
      type: Number,
      required: true,
      default: 10,
    },
    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>("User", UserSchema);
export default User;
