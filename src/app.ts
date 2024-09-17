import express, { Express, Request, Response } from 'express';
import http from 'http';
import config from './config';
import connectDB from './db/connect';
import defaultRoutes from './routes/index';
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import cors from 'cors';
import setupChatServer from './services/chatService';

const app: Express = express();
const server = http.createServer(app);

const port = config.PORT;
app.use(express.json());
app.use(cors());

connectDB();

app.use('/', defaultRoutes);
app.use('/auth', authRoutes);
app.use('/connect', chatRoutes);

setupChatServer(server);

server.listen(port, () => {
  console.log(`Chat Server running at http://localhost:${port}`);
})
