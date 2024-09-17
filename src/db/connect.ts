import mongoose from "mongoose";
import config from "../config";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(config.DATABASE_URL);
    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

export default connectDB;