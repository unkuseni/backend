import mongoose from "mongoose";
import User from "./models/user";
import config from "./config";

async function cleanupTempUsers() {
  try {
    await mongoose.connect(config.DATABASE_URL);
    console.log("Connected to MongoDB");

    const result = await User.deleteMany({
      isTemporary: true,
      expiresAt: { $lt: new Date() },
    });

    console.log(`Deleted ${result.deletedCount} expired temporary users.`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error cleaning up temporary users:", error);
  }
}

cleanupTempUsers();
