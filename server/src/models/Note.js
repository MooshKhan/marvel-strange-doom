import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    character: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

noteSchema.index({ character: 1, createdAt: -1, _id: -1 });
noteSchema.index({ owner: 1, character: 1, createdAt: -1, _id: -1 });

const Note = mongoose.model("Note", noteSchema);

export default Note;
