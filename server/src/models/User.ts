import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export type UserRecord = {
  username: string;
  passwordHash: string;
};

const userSchema =
  new Schema<UserRecord>(
    {
      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      passwordHash: {
        type: String,
        required: true,
        select: false,
      },
    },
    {
      timestamps: true,
    }
  );

const existingUserModel =
  mongoose.models.User as
    | Model<UserRecord>
    | undefined;

const User =
  existingUserModel ??
  mongoose.model<UserRecord>(
    "User",
    userSchema
  );

export default User;