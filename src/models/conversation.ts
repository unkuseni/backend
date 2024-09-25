import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  participants: string[];
  lastMessage: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema({
  participants: [{ type: String, ref: "User" }], // Changed to String
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  updatedAt: { type: Date, default: Date.now },
});

// Ensure that a conversation always has exactly two participants
ConversationSchema.pre<IConversation>("save", function (next) {
  if (this.participants.length !== 2) {
    next(new Error("A conversation must have exactly two participants"));
  } else {
    next();
  }
});

// Create a unique compound index on participants to prevent duplicate conversations
ConversationSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema,
);
