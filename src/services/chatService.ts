import { Server as HTTPServer } from "http";
import { log } from "console";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer, Socket } from "socket.io";
import User from "../models/user";
import Message from "../models/message";
import Conversation from "../models/conversation";
import { getUserByUsername } from "../routes/chatRoutes";
import config from "../config";
import { callQueue } from "../middleware/callQueue";

interface ExtendedSocket extends Socket {
  username?: string;
  isGuest?: boolean;
}

export default function setupChatServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.FRONTEND_URL,
      methods: ["GET", "POST"],
    },
  });

  const connectedUsers = new Map<
    string,
    { socket: ExtendedSocket; isGuest: boolean }
  >();
  io.on("connection", (socket: ExtendedSocket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on(
      "joinCallQueue",
      async (preferences: { genderPreference: string }) => {
        const userInfo = getUserInfoFromSocket(socket);
        if (userInfo) {
          const user = await User.findOne({ username: userInfo.username });
          if (user) {
            callQueue.addToQueue({
              id: userInfo.username,
              isGuest: userInfo.isGuest,
              socketId: socket.id,
              gender: user.getGender(),
              genderPreference:
                preferences.genderPreference || user.getGenderPreference(),
            });
            socket.emit("queueJoined", callQueue.getQueueLengths());
          }
        }
      },
    );

    socket.on("leaveCallQueue", () => {
      const userInfo = getUserInfoFromSocket(socket);
      if (userInfo) {
        callQueue.removeFromQueue(userInfo.username);
        socket.emit("queueLeft");
      }
    });

    socket.on("callEnded", async () => {
      const userInfo = getUserInfoFromSocket(socket);
      if (userInfo) {
        const user = await User.findOne({ username: userInfo.username });
        if (user) {
          callQueue.addToQueue({
            id: userInfo.username,
            isGuest: userInfo.isGuest,
            socketId: socket.id,
            gender: user.getGender(),
            genderPreference: user.getGenderPreference(),
          });
        }
      }
    });

    socket.on("authenticate", async (token: string) => {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as {
          username: string;
          isGuest: boolean;
          canCall: boolean;
        };

        socket.username = decoded.username;
        socket.isGuest = decoded.isGuest;

        connectedUsers.set(decoded.username, {
          socket,
          isGuest: decoded.isGuest,
        });

        socket.emit("authenticated", {
          isGuest: decoded.isGuest,
          canCall: decoded.canCall,
        });

        if (!decoded.isGuest) {
          const user = await User.findOne({ username: decoded.username });
          if (user) {
            const missedMessages = await Message.find({
              recipient: user._id,
              timestamp: { $gt: Date.now() - 60 * 60 * 1000 },
            }).sort({ timestamp: 1 });

            missedMessages.forEach((message) => {
              socket.emit("new_message", {
                senderUsername: message.sender,
                content: message.content,
                timestamp: message.timestamp,
              });
            });
          }
        }
      } catch (error) {
        socket.emit("authentication_error");
      }
    });

    socket.on("typing", (data: { recipientId: string }) => {
      const userInfo = getUserInfoFromSocket(socket);
      if (userInfo) {
        const recipientInfo = connectedUsers.get(data.recipientId);
        if (recipientInfo) {
          recipientInfo.socket.emit("user_typing", {
            senderId: userInfo.username,
          });
        }
      }
    });

    socket.on("stop_typing", (data: { recipientId: string }) => {
      const userInfo = getUserInfoFromSocket(socket);
      if (userInfo) {
        const recipientInfo = connectedUsers.get(data.recipientId);
        if (recipientInfo) {
          recipientInfo.socket.emit("user_stop_typing", {
            senderId: userInfo.username,
          });
        }
      }
    });

    // Chat code here
    socket.on(
      "message",
      async (data: {
        conversationId: string;
        content: string;
        recipientUsername: string;
      }) => {
        const userInfo = getUserInfoFromSocket(socket);
        if (userInfo && !userInfo.isGuest) {
          try {
            let conversation;
            if (data.conversationId) {
              conversation = await Conversation.findById(data.conversationId);
            }
            if (!conversation) {
              // Create a new conversation if it doesn't exist
              const recipient = await getUserByUsername(data.recipientUsername);
              if (!recipient) {
                throw new Error("Recipient not found");
              }
              conversation = new Conversation({
                participants: [userInfo.username, recipient.username],
              });
              await conversation.save();
            }

            const message = new Message({
              conversation: data.conversationId,
              sender: userInfo.username,
              content: data.content,
            });
            await message.save();

            // Update the conversation's last message and timestamp
            conversation.lastMessage = message._id;
            conversation.updatedAt = new Date();
            await conversation.save();

            // Send the message to all participants in the conversation
            for (const participantId of conversation.participants) {
              if (participantId.toString() !== userInfo.username) {
                const recipientInfo = connectedUsers.get(
                  participantId.toString(),
                );
                if (recipientInfo) {
                  recipientInfo.socket.emit("new_message", {
                    conversationId: data.conversationId,
                    senderId: userInfo.username,
                    content: data.content,
                    timestamp: message.timestamp,
                  });
                }
              }
            }

            // Confirm to the sender that the message was sent
            socket.emit("message_sent", {
              messageId: message._id,
              conversationId: data.conversationId,
              content: data.content,
              timestamp: message.timestamp,
            });
          } catch (error) {
            console.error("Error saving message:", error);
            socket.emit("message_error", { error: "Failed to send message" });
          }
        } else {
          socket.emit("message_error", {
            error: "Guests cannot send messages",
          });
        }
      },
    );

    // Video call signaling
    socket.on(
      "video_call_offer",
      (data: { recipientId: string; offer: any }) => {
        const userInfo = getUserInfoFromSocket(socket);
        if (userInfo) {
          const recipientInfo = connectedUsers.get(data.recipientId);
          if (recipientInfo) {
            recipientInfo.socket.emit("video_call_offer", {
              callerId: userInfo.username,
              offer: data.offer,
            });
          }
        }
      },
    );

    socket.on(
      "video_call_answer",
      (data: { callerId: string; answer: any }) => {
        const recipientInfo = connectedUsers.get(data.callerId);
        if (recipientInfo) {
          recipientInfo.socket.emit("video_call_answer", {
            answer: data.answer,
          });
        }
      },
    );

    socket.on(
      "ice_candidate",
      (data: { recipientId: string; candidate: any }) => {
        const userInfo = getUserInfoFromSocket(socket);
        if (userInfo) {
          const recipientInfo = connectedUsers.get(data.recipientId);
          if (recipientInfo) {
            recipientInfo.socket.emit("ice_candidate", {
              senderId: userInfo.username,
              candidate: data.candidate,
            });
          }
        }
      },
    );

    socket.on("disconnect", () => {
      if (socket.username) {
        connectedUsers.delete(socket.username);
      }
      console.log("A user disconnected");
    });
  });

  setInterval(() => {
    const pair = callQueue.getPair();
    if (pair) {
      const [user1, user2] = pair;
      const room = `call-${Date.now()}`;

      io.to(user1.socketId).emit("callMatched", { room, isInitiator: true });
      io.to(user2.socketId).emit("callMatched", { room, isInitiator: false });
    }
  }, 600);

  //TODO: Implement token verification logic here
  //TODO: Return the user ID if the token is valid
  //TODO: Throw an error if the token is invalid
  function verifyToken(token: string): string {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { _id: string };
      return decoded._id;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  function getUserInfoFromSocket(
    socket: ExtendedSocket,
  ): { username: string; isGuest: boolean } | null {
    for (const [username, info] of connectedUsers.entries()) {
      if (info.socket === socket) {
        return { username, isGuest: info.isGuest };
      }
    }
    return null;
  }
}
