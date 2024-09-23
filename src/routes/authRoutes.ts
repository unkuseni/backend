import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";

import config from "../config";
import User from "../models/user";
import {
  authenticateNonGuestToken,
  authenticateToken,
} from "../middleware/auth";

export interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
    isGuest?: boolean;
    canCall?: boolean;
  };
}

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username, email, and password",
        errors: {
          username: !username ? "Username is required" : null,
          email: !email ? "Email is required" : null,
          password: !password ? "Password is required" : null,
        },
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
        errors: {
          email: existingUser.email === email ? "Email already in use" : null,
          username:
            existingUser.username === username
              ? "Username already taken"
              : null,
        },
      });
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create new user
    const newUser = new User({
      username,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
    });

    await newUser.save();

    // TODO: Send verification email here

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
      verificationInfo: {
        message: "Please check your email to verify your account",
        expiresIn: "24 hours",
      },
    });
  } catch (error) {
    console.error("Error in user registration:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred during registration",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error verifying email" });
  }
});

router.get(
  "/user/:username",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const user = await User.findOne({ username }).select("_id username");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ _id: user._id, username: user.username });
    } catch (error) {
      res.status(500).json({ message: "Error fetching user", error });
    }
  },
);

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password",
        errors: {
          email: !email ? "Email is required" : null,
          password: !password ? "Password is required" : null,
        },
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        errors: {
          email: "No user found with this email",
        },
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Email not verified",
        errors: {
          email: "Please verify your email before logging in",
        },
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        errors: {
          password: "Incorrect password",
        },
      });
    }

    // Generate token
    const token = jwt.sign({ _id: user._id }, config.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      },
      tokenInfo: {
        expiresIn: "1 hour",
      },
    });
  } catch (error) {
    console.error("Error in user login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred during login",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.post("/logout", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    // In a token-based authentication system, the actual token invalidation
    // typically happens on the client-side.

    res.status(200).json({
      success: true,
      message: "Logout successful",
      data: {
        userId: req.user?._id,
        logoutTime: new Date().toISOString(),
      },
      info: {
        message: "Please ensure you remove the token from your client storage.",
        nextSteps: [
          "Clear any user-related data from local storage or state",
          "Redirect the user to the login page or home page",
        ],
      },
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during logout",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.put(
  "/updatepassword",
  authenticateNonGuestToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Please provide both current and new password",
          errors: {
            currentPassword: !currentPassword
              ? "Current password is required"
              : null,
            newPassword: !newPassword ? "New password is required" : null,
          },
        });
      }

      // Find user
      const user = await User.findById(req.user?._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          errors: {
            user: "Unable to find user with the provided ID",
          },
        });
      }

      // Compare current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Password update failed",
          errors: {
            currentPassword: "Current password is incorrect",
          },
        });
      }

      // Update password
      user.password = newPassword;
      const updatedUser = await user.save();

      res.json({
        success: true,
        message: "Password updated successfully",
        data: {
          userId: updatedUser._id,
          username: updatedUser.username,
          updatedAt:
            updatedUser.updatedAt instanceof Date
              ? updatedUser.updatedAt.toISOString()
              : new Date().toISOString(),
        },
        info: {
          message: "Your password has been successfully updated.",
          nextSteps: [
            "Use your new password for future logins",
            "Consider logging out of other devices for security",
          ],
        },
      });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while updating password",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

router.post("/guest-access", async (req: Request, res: Response) => {
  try {
    const guestId = new mongoose.Types.ObjectId();

    const token = jwt.sign(
      { _id: guestId, isGuest: true, canCall: true },
      config.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      success: true,
      message: "Guest access granted",
      data: {
        token,
        user: {
          id: guestId,
          username: "Guest",
          isGuest: true,
          canCall: true,
        },
      },
      tokenInfo: {
        expiresIn: "1 hour",
      },
      info: {
        message: "You have been granted temporary guest access.",
        capabilities: [
          "You can make and join calls",
          "Chat feature is not available for guest users",
        ],
      },
    });
  } catch (error) {
    console.error("Error granting guest access:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while granting guest access",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.put(
  "/update-preferences",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { genderPreference } = req.body;
      const user = await User.findById(req.user?._id);
      if (user) {
        user.genderPreference = genderPreference;
        await user.save();
        res.json({
          message: "Preferences updated successfully",
          genderPreference,
        });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating preferences", error });
    }
  },
);

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        errors: {
          email: "Email is required",
        },
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // For security reasons, don't reveal that the user doesn't exist
      return res.status(200).json({
        success: true,
        message:
          "If a user with that email exists, a password reset link has been sent.",
      });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpires = Date.now() + 3600000; // 1 hour from now

    // Save the reset token and expiry to the user document
    // user.resetPasswordToken = resetToken;
    // user.resetPasswordExpires = new Date(resetTokenExpires);
    await user.save();

    // Send password reset email
    const resetUrl = `http://myaddress/reset-password/${resetToken}`;
    // await sendPasswordResetEmail(user.email, resetUrl);

    res.status(200).json({
      success: true,
      message:
        "If a user with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Error in forgot password process:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred during the forgot password process",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

router.delete(
  "/deleteuser",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?._id;

      // Find the user and delete
      const deletedUser = await User.findByIdAndDelete(userId);

      if (!deletedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          errors: {
            user: "Unable to find user with the provided ID",
          },
        });
      }

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: {
          userId: deletedUser._id,
          username: deletedUser.username,
          email: deletedUser.email,
          deletedAt: new Date().toISOString(),
        },
        info: {
          message: "Your account has been permanently deleted.",
          nextSteps: [
            "Clear any remaining local storage or cookies related to your account",
            "Uninstall or log out from any applications associated with this account",
          ],
        },
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while deleting user",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

export default router;
