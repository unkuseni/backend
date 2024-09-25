import express, { Express, Request, Response } from "express";
import http from "http";
import config from "./config";
import connectDB from "./db/connect";
import defaultRoutes from "./routes/index";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import cors from "cors";
import setupChatServer from "./services/chatService";
import cron from "node-cron";
import { exec } from "child_process";

const app: Express = express();
const server = http.createServer(app);

const port = config.PORT;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

connectDB();

app.use("/", defaultRoutes);
app.use("/auth", authRoutes);
app.use("/connect", chatRoutes);

setupChatServer(server);

cron.schedule("0 * * * *", () => {
  exec("ts-node src/cleanupTempUsers.ts", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running cleanup script: ${error}`);
      return;
    }
    console.log(`Cleanup script output: ${stdout}`);
    if (stderr) {
      console.error(`Cleanup script errors: ${stderr}`);
    }
  });
});

server.listen(port, () => {
  console.log(`Chat Server running at http://localhost:${port}`);
});
