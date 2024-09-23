import { Router, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "./authRoutes";
import Message from "../models/message";
import Conversation from "../models/conversation";

const router = Router();

router.post("/chat", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.isGuest) {
    return res.status(403).json({
      success: false,
      message: "Chat feature is not available for guest users",
    });
  }

  try {
    const { receiverId } = req.body;
    const senderId = req.user?._id;

    res.json({ receiverId, senderId });
  } catch (error) {
    res.status(500).json({ message: "Error creating chat" });
  }
});

router.post("/call", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user?._id;

    const roomId = `${senderId}-${receiverId}-${Date.now()}`;
    res.json({ roomId, senderId, receiverId });
  } catch (error) {
    res.status(500).json({ message: "Error initializing call" });
  }
});

router.post(
  "/conversation",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { participantId } = req.body;
      const currentUserId = req.user?._id;

      let conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, participantId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: [currentUserId, participantId],
        });
        await conversation.save();
      }

      res.json({ conversationId: conversation._id });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error creating/retrieving conversation", error });
    }
  },
);

router.get(
  "/chat-history/:userId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.user?._id;
      const otherUserId = req.params.userId;

      const messages = await Message.find({
        $or: [
          { sender: currentUserId, recipient: otherUserId },
          { sender: otherUserId, recipient: currentUserId },
        ],
      }).sort({ timestamp: 1 });

      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching chat history", error });
    }
  },
);

router.delete(
  "/chat-history/:userId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.user?._id;
      const otherUserId = req.params.userId;

      await Message.deleteMany({
        $or: [
          { sender: currentUserId, recipient: otherUserId },
          { sender: otherUserId, recipient: currentUserId },
        ],
      });

      res.json({ message: "Chat history deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting chat history", error });
    }
  },
);

router.get(
  "/chat-history/:userId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.user?._id;
      const otherUserId = req.params.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await Message.find({
        $or: [
          { sender: currentUserId, recipient: otherUserId },
          { sender: otherUserId, recipient: currentUserId },
        ],
      })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Message.countDocuments({
        $or: [
          { sender: currentUserId, recipient: otherUserId },
          { sender: otherUserId, recipient: currentUserId },
        ],
      });

      res.json({
        messages: messages.reverse(),
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalMessages: total,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching chat history", error });
    }
  },
);

export default router;
