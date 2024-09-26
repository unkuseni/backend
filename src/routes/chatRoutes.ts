import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { call, chat, chatHistory, convo, deleteChatHistory } from "../controllers/chatController";

const router = Router();



router.post("/chat", authenticateToken, chat);

router.post("/call", authenticateToken, call);

router.post(
  "/conversation",
  authenticateToken,
  convo
);
router.get(
  "/chat-history/:username",
  authenticateToken,
  chatHistory
);

router.delete(
  "/chat-history/:otherUsername",
  authenticateToken,
  deleteChatHistory
);

export default router;
