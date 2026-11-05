import mongoose, { Schema, model } from "mongoose";

/**
 * The AI coach settings an admin chooses (one document, `_id: "ai"`). Unset fields fall back to the
 * environment; the OpenRouter key itself only ever lives in the environment.
 */
const aiSettingsSchema = new Schema(
  {
    _id: { type: String, default: "ai" },
    enabled: { type: Boolean, default: true },
    primaryModel: String,
    fallbackModel: { type: String, default: "" },
    dailyLimit: Number,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const AiSettings = mongoose.models.AiSettings || model("AiSettings", aiSettingsSchema);
