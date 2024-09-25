import { Router, Response } from "express";
import { AuthRequest, authenticateToken } from "../middleware/auth";

import Message from "../models/message";
import Conversation from "../models/conversation";
import User from "../models/user";

const router = Router();

export async function getUserByUsername(username: string) {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    throw new Error("Failed to fetch user");
  }
}

router.post("/chat", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.isGuest) {
      return res.status(403).json({
        success: false,
        message: "Chat feature is not available for guest users",
        info: {
          nextSteps: [
            "Register for a full account to access chat features",
            "Use call features which are available for guests",
          ],
        },
      });
    }

    const { receiverUsername } = req.body;
    const senderUsername = req.user?.username;

    if (!senderUsername || !receiverUsername) {
      return res.status(400).json({
        success: false,
        message: "Both sender and receiver usernames are required",
      });
    }

    res.json({
      success: true,
      message: "Chat initiated successfully",
      data: {
        senderUsername,
        receiverUsername,
      },
      info: {
        nextSteps: [
          "Create or retrieve a conversation using the /conversation endpoint",
          "Start sending messages to this recipient",
          "Set up real-time updates for incoming messages",
        ],
      },
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate chat",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.post("/call", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user?._id;

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: "Both sender and receiver IDs are required",
      });
    }

    const roomId = `${senderId}-${receiverId}-${Date.now()}`;

    res.json({
      success: true,
      message: "Call initiated successfully",
      data: {
        roomId,
        senderId,
        receiverId,
      },
      info: {
        nextSteps: [
          "Use the roomId to establish a WebRTC connection",
          "Wait for the receiver to join the call",
        ],
      },
    });
  } catch (error) {
    console.error("Error initializing call:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize call",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.post(
  "/conversation",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { participantId } = req.body;
      const currentUserId = req.user?._id;

      if (!currentUserId || !participantId) {
        return res.status(400).json({
          success: false,
          message: "Both current user and participant IDs are required",
        });
      }

      let conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, participantId] },
      });

      let isNewConversation = false;
      if (!conversation) {
        conversation = new Conversation({
          participants: [currentUserId, participantId],
        });
        await conversation.save();
        isNewConversation = true;
      }

      res.json({
        success: true,
        message: isNewConversation
          ? "New conversation created successfully"
          : "Existing conversation retrieved successfully",
        data: {
          conversationId: conversation._id,
          participants: conversation.participants,
          isNewConversation,
        },
        info: {
          nextSteps: [
            "Use the conversationId for sending and receiving messages",
            "Fetch previous messages if it's an existing conversation",
          ],
        },
      });
    } catch (error) {
      console.error("Error creating/retrieving conversation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create/retrieve conversation",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);
router.get(
  "/chat-history/:username",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUsername = req.user?.username;
      const otherUsername = req.params.username;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      console.log("Current Username:", currentUsername);
      console.log("Other Username:", otherUsername);

      if (!currentUsername || !otherUsername) {
        return res.status(400).json({
          success: false,
          message: "Both current user and other user usernames are required",
        });
      }

      const [currentUser, otherUser] = await Promise.all([
        User.findOne({ username: currentUsername }),
        User.findOne({ username: otherUsername }),
      ]);

      if (!currentUser || !otherUser) {
        return res.status(404).json({
          success: false,
          message: "One or both users not found",
        });
      }

      const messages = await Message.find({
        $or: [
          { sender: currentUser._id, recipient: otherUser._id },
          { sender: otherUser._id, recipient: currentUser._id },
        ],
      })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("sender", "username")
        .lean();

      const total = await Message.countDocuments({
        $or: [
          { sender: currentUser._id, recipient: otherUser._id },
          { sender: otherUser._id, recipient: currentUser._id },
        ],
      });

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        message: "Chat history retrieved successfully",
        data: {
          messages: messages.reverse(),
          pagination: {
            currentPage: page,
            totalPages,
            totalMessages: total,
            messagesPerPage: limit,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat history",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

router.delete(
  "/chat-history/:otherUsername",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUsername = req.user?.username;
      const otherUsername = req.params.otherUsername;

      if (!currentUsername || !otherUsername) {
        return res.status(400).json({
          success: false,
          message: "Both current user and other user usernames are required",
        });
      }

      // Find the conversation between the two users
      const conversation = await Conversation.findOne({
        participants: { $all: [currentUsername, otherUsername] },
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "No conversation found between the specified users",
        });
      }

      // Delete all messages in the conversation
      const result = await Message.deleteMany({
        conversation: conversation._id,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "No messages found to delete",
        });
      }

      // Optionally, you might want to delete the conversation as well
      await Conversation.findByIdAndDelete(conversation._id);

      res.json({
        success: true,
        message: "Chat history deleted successfully",
        data: {
          deletedCount: result.deletedCount,
        },
        info: {
          nextSteps: [
            "Update the UI to reflect the deleted chat history",
            "Clear any local storage or cache related to this chat",
            "Inform the user that the chat history has been permanently deleted",
          ],
        },
      });
    } catch (error) {
      console.error("Error deleting chat history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete chat history",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

export default router;
