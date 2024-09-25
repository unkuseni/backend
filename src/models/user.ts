import bcrypt from "bcrypt";
import mongoose, { Schema, Document } from "mongoose";

interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  isVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  updatedAt: Date;
  comparePassword: (test_password: string) => Promise<boolean>;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  gender: string;
  genderPreference: string;
  getGender: () => string;
  getGenderPreference: () => string;
  isTemporary: boolean;
  expiresAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  verificationTokenExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
  },
  genderPreference: {
    type: String,
    enum: ["male", "female", "any"],
    default: "any",
  },
  isTemporary: { type: Boolean, default: false },
  expiresAt: { type: Date },
});

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(this.password, salt);
  this.password = hashedPassword;
  next();
});
UserSchema.methods.getGender = function () {
  return this.gender as string;
};

UserSchema.methods.getGenderPreference = function () {
  return this.genderPreference as string;
};

UserSchema.methods.comparePassword = async function (test_password: string) {
  return await bcrypt.compare(test_password, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
