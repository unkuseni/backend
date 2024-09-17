import { Server as HTTPServer } from 'http';
import { log } from 'console';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';
import User from '../models/user';
import Message from '../models/message';
import Conversation from '../models/conversation';
import config from '../config';

export default function setupChatServer(httpServer: HTTPServer) {

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.FRONTEND_URL,
      methods: ["GET", "POST"],
    },
  });

  const connectedUsers = new Map<string, Socket>();

  io.on('connection', (socket: Socket) => {
    log(`User connected: ${socket.id}`);


    // user authentication
    socket.on('authenticate', async (token: string) => {
      try {
        const userId = verifyToken(token);
        const user = await User.findById(userId);
        if (user) {
          connectedUsers.set(userId, socket);
          socket.emit('authenticated');

          // Fetch and send any missed messages
          const missedMessages = await Message.find({
            recipient: userId,
            timestamp: { $gt: Date.now() - 60 * 60 * 1000 } // Assuming you track when the user was last online
          }).sort({ timestamp: 1 });

          missedMessages.forEach(message => {
            socket.emit('new_message', {
              senderId: message.sender,
              content: message.content,
              timestamp: message.timestamp
            });
          });

        
          await user.save();
        }
      } catch (error) {
        socket.emit('authentication_error');
      }
    });

    socket.on('typing', (data: { recipientId: string }) => {
      const senderId = getUserIdFromSocket(socket);
      if (senderId) {
        const recipientSocket = connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_typing', { senderId });
        }
      }
    });

    socket.on('stop_typing', (data: { recipientId: string }) => {
      const senderId = getUserIdFromSocket(socket);
      if (senderId) {
        const recipientSocket = connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_stop_typing', { senderId });
        }
      }
    });

    // Chat functionality
    socket.on('message', async (data: {
      conversationId: string;
      content: string;
    }) => {
      const senderId = getUserIdFromSocket(socket);
      if (senderId) {
        try {
          const conversation = await Conversation.findById(data.conversationId);
          if (!conversation) {
            throw new Error('Conversation not found');
          }

          const message = new Message({
            conversation: data.conversationId,
            sender: senderId,
            content: data.content
          });
          await message.save();

          // Update the conversation's last message and timestamp
          conversation.lastMessage = message._id;
          conversation.updatedAt = new Date();
          await conversation.save();

          // Send the message to all participants in the conversation
          for (const participantId of conversation.participants) {
            if (participantId.toString() !== senderId) {
              const recipientSocket = connectedUsers.get(participantId.toString());
              if (recipientSocket) {
                recipientSocket.emit('new_message', {
                  conversationId: data.conversationId,
                  senderId,
                  content: data.content,
                  timestamp: message.timestamp
                });
              }
            }
          }

          // Confirm to the sender that the message was sent
          socket.emit('message_sent', {
            messageId: message._id,
            conversationId: data.conversationId,
            content: data.content,
            timestamp: message.timestamp
          });
        } catch (error) {
          console.error('Error saving message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
        }
      }
    });

    // Video call signaling
    socket.on('video_call_offer', (data: { recipientId: string, offer: any }) => {
      const callerId = getUserIdFromSocket(socket);
      if (callerId) {
        const recipientSocket = connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('video_call_offer', { callerId, offer: data.offer });
        }
      }
    });


    socket.on('video_call_answer', (data: { callerId: string, answer: any }) => {
      const recipientSocket = connectedUsers.get(data.callerId);
      if (recipientSocket) {
        recipientSocket.emit('video_call_answer', { answer: data.answer });
      }
    });

    socket.on('ice_candidate', (data: { recipientId: string, candidate: any }) => {
      const senderId = getUserIdFromSocket(socket);
      if (senderId) {
        const recipientSocket = connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('ice_candidate', { senderId, candidate: data.candidate });
        }
      }
    });

    socket.on('disconnect', () => {
      const userId = getUserIdFromSocket(socket);
      if (userId) {
        connectedUsers.delete(userId);
      }
      console.log('A user disconnected');
    });

  });



  //TODO: Implement token verification logic here
  //TODO: Return the user ID if the token is valid
  //TODO: Throw an error if the token is invalid
  function verifyToken(token: string): string {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { _id: string };
      return decoded._id;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }


  function getUserIdFromSocket(socket: Socket): string | null {
    for (const [userId, userSocket] of connectedUsers.entries()) {
      if (userSocket === socket) {
        return userId;
      }
    }
    return null;
  }
}


