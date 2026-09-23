import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export type CharacterAlignment =
  | "good"
  | "bad"
  | "neutral"
  | "unknown";

export type CharacterRecord = {
  sourceId: number;
  name: string;
  slug: string;

  biography: {
    fullName: string;
    publisher: string;
    alignment: CharacterAlignment;
  };

  images?: {
    md?: string;
    lg?: string;
  };

  sourceVersion: string;
  importedAt: Date;
};

const characterSchema =
  new Schema<CharacterRecord>(
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
          enum: [
            "good",
            "bad",
            "neutral",
            "unknown",
          ],
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

const existingCharacterModel =
  mongoose.models.Character as
    | Model<CharacterRecord>
    | undefined;

const Character =
  existingCharacterModel ??
  mongoose.model<CharacterRecord>(
    "Character",
    characterSchema
  );

export default Character;