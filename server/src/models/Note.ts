import mongoose, {
  Schema,
  type Model,
  type Types,
} from "mongoose";

export type NoteRecord = {
  owner: Types.ObjectId;
  character: Types.ObjectId;
  text: string;
};

const noteSchema =
  new Schema<NoteRecord>(
    {
      owner: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        required: true,
      },

      character: {
        type:
          mongoose.Schema.Types
            .ObjectId,
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

noteSchema.index({
  character: 1,
  createdAt: -1,
  _id: -1,
});

noteSchema.index({
  owner: 1,
  character: 1,
  createdAt: -1,
  _id: -1,
});

const existingNoteModel =
  mongoose.models.Note as
    | Model<NoteRecord>
    | undefined;

const Note =
  existingNoteModel ??
  mongoose.model<NoteRecord>(
    "Note",
    noteSchema
  );

export default Note;