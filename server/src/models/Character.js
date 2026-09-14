import mongoose from "mongoose";

const characterSchema = new mongoose.Schema(
  {
    sourceId: {
      type: Number,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
    },

    biography: {
      fullName: {
        type: String,
        default: "",
      },
      publisher: {
        type: String,
        required: true,
      },
      alignment: {
        type: String,
        enum: ["good", "bad", "neutral", "unknown"],
        default: "unknown",
      },
    },

    images: {
      md: String,
      lg: String,
    },

    sourceVersion: {
      type: String,
      required: true,
    },

    importedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Character = mongoose.model("Character", characterSchema);

export default Character;