import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";

import User from "../models/user";
import Message from "../models/message";
import Conversation from "../models/conversation";



/**
 * Fetches a user by their username.
 *
 * @param {string} username - The username to search for.
 * @returns {Promise<User | null>} The user object if found, or null if not found.
 * @throws {Error} If an error occurs while fetching the user.
 */
export async function getUserByUsername(username: string) {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    throw new Error("Failed to fetch user");
  }
}

/**
 * Initiates a chat between two users.
 *
 * Request body:
 *   - receiverUsername: string (required)
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: {
 *       senderUsername: string,
 *       receiverUsername: string,
 *     }
 *   - info: {
 *       nextSteps: string[],
 *     }
 *
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {HTTPError} If the user is a guest.
 * @throws {HTTPError} If the request body is invalid.
 * @throws {Error} If an internal server error occurs.
 */
export const chat = (req: AuthRequest, res: Response) => {
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
}

/**
 * Handles call initialization by validating input, generating a room ID and
 * sending it back to the client.
 *
 * Request body:
 *   - receiverId: string (required)
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: {
 *       roomId: string (unique identifier for the call),
 *       senderId: string (the ID of the user initiating the call),
 *       receiverId: string (the ID of the user receiving the call),
 *     }
 *   - info: {
 *       nextSteps: string[] (instructions for the client to follow),
 *     }
 *
 * Error handling:
 *   - Internal Server Error (500): Returns a JSON response with the error
 *     message and a boolean indicating whether the error message is for
 *     development only.
 */
export const call = (req: AuthRequest, res: Response) => {
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
}

/**
 * Handles creating a new conversation or retrieving an existing one.
 * If the conversation already exists, it will be retrieved.
 * If the conversation does not exist, a new one will be created.
 * The response will include the conversation ID and a boolean indicating
 * whether the conversation is new or existing.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.participantId - The ID of the participant to start a conversation with.
 * @returns {Promise<Response>}
 */
export const convo = async (req: AuthRequest, res: Response) => {
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
}

  /**
   * Retrieves the chat history for the current user and the given user.
   * Purpose: Handles retrieving the chat history between the current user and the given user.
   * Flow:
   *  1. Validates the input: returns a 400 error if either the current user or other user usernames are not provided.
   *  2. Finds the two users: returns a 404 error if one or both users are not found.
   *  3. Retrieves the messages between the two users: returns a 500 error if an internal server error occurs.
   *  4. Paginates the messages: returns a 200 response with the paginated messages and pagination data.
   * Error Handling:
   *  - Returns a 400 error response if either the current user or other user usernames are not provided.
   *  - Returns a 404 error response if one or both users are not found.
   *  - Returns a 500 error response if an internal server error occurs.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   *
   * @returns {Promise<void>} A promise that resolves to nothing.
   *
   * @throws {Error} If an internal server error occurs.
   * @throws {HTTPError} If the user is not found.
   */
export const chatHistory = async (req: AuthRequest, res: Response) => {
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
}

export const deleteChatHistory = async (req: AuthRequest, res: Response) => {
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
}