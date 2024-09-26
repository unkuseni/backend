import jwt from 'jsonwebtoken';
import { Request, Response } from "express";
import crypto from "crypto";
import config from "../config";
import { sendPasswordResetEmail, sendVerificationEmail } from "../middleware/emailer";
import User from "../models/user";
import { AuthRequest, verifyToken } from "../middleware/auth";
import mongoose from 'mongoose';



/**
 * Registers a new user.
 * Purpose: Handles user registration by validating input, checking for existing users, creating a new user, and sending a verification email.

Flow:

Extracts username, email, and password from the request body.
Validates input: returns a 400 error if any field is missing.
Checks if a user with the same email or username already exists: returns a 409 error if so.
Creates a verification token and a new user document with the provided details.
Saves the new user document to the database.
Sends a verification email to the user (TODO: implement this).
Returns a 201 response with the new user's details and a verification message.
Error Handling:

Catches any internal server errors and returns a 500 error response with a generic error message.
In development mode, includes the error message in the response.
 *
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {Error} If an internal server error occurs.
 * @throws {HTTPError} If the user already exists.
 */
export const register = async (req: Request, res: Response) => {
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
    await sendVerificationEmail(
      newUser.email,
      newUser.username,
      verificationToken,
    );

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
}

/**
 * Verify a user's email address using a verification token.
 *
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {HTTPError} If the user is not found, or if the verification token is invalid or expired.
 */
export const verifyEmailToken = async (req, res) => {
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
}

/**
 * Verifies a given login token and returns its validity.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {HTTPError} If the token is invalid or expired.
 *
 * @example
 * // Request
 * GET /check-login-token
 * Authorization: Bearer <token>
 *
 * // Response
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 * {
 *   "success": true,
 *   "message": "Token is valid",
 *   "valid": true,
 *   "data": {
 *     "userId": "<id>",
 *     "username": "<username>",
 *     "isGuest": <boolean>,
 *     "canCall": <boolean>,
 *     "expiresAt": "<ISO-date-string>",
 *   }
 * }
 */
export const checkLoginToken = (req: Request, res: Response) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
      valid: false,
    });
  }

  try {
    const decoded = verifyToken(token);

    // Check if the token has expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTimestamp) {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
        valid: false,
      });
    }

    // Token is valid
    res.json({
      success: true,
      message: "Token is valid",
      valid: true,
      data: {
        userId: decoded._id,
        username: decoded.username,
        isGuest: decoded.isGuest,
        canCall: decoded.canCall,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      valid: false,
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
}

/**
 * Gets the user ID and username from the provided username.
 *
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {Error} If an error occurs while fetching the user.
 * @throws {HTTPError} If the user is not found.
 */
export const getUserId = async (req: Request, res: Response) => {
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
}

/**
 * Handles user login by validating input, checking for existing users, comparing password, and generating a JWT token.
 *
 * Request body:
 *   - email: string
 *   - password: string
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: {
 *       token: string,
 *       user: {
 *         id: string,
 *         username: string,
 *         email: string,
 *       },
 *     }
 *   - tokenInfo: {
 *       expiresIn: string,
 *     }
 *   - error: {
 *       email: string,
 *       password: string,
 *     }
 *
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {Error} If an internal server error occurs.
 * @throws {HTTPError} If the input is invalid, user not found, incorrect password, or email not verified.
 */
export const loginUser = async (req: Request, res: Response) => {
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
    const token = jwt.sign(
      { _id: user._id, username: user.username, isGuest: false, canCall: true },
      config.JWT_SECRET,
      { expiresIn: "1h" },
    );

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
}

/**
 * Logs out the user and clears any user-related data from the server.
 *
 * In a token-based authentication system, the actual token invalidation
 * typically happens on the client-side. This endpoint is mostly for
 * convenience and to provide a standard way to log out users.
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: {
 *       userId: string,
 *       logoutTime: string (ISO 8601 format),
 *     }
 *   - info: {
 *       message: string,
 *       nextSteps: string[],
 *     }
 *
 * Error Handling:
 *   - Internal Server Error (500): Returns a JSON response with the error message
 *     and a boolean indicating whether the error message is for development only.
 */
export const logoutUser = (req: AuthRequest, res: Response) => {
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
}


/**
 * Updates the password for the user with the provided ID.
 * Purpose: Handles updating the password for a user, given the current and new passwords.
 * Flow:
 *  1. Validates the input: returns a 400 error if either the current or new password is not provided.
 *  2. Finds the user: returns a 404 error if the user is not found.
 *  3. Compares the current password with the stored hash: returns a 400 error if the comparison fails.
 *  4. Updates the password hash: returns a 200 response with the updated user's details and a success message.
 *  5. Catches any internal server errors and returns a 500 error response with a generic error message.
 * Error Handling:
 *  - Returns a 400 error response if either the current or new password is not provided.
 *  - Returns a 404 error response if the user is not found.
 *  - Returns a 500 error response if an internal server error occurs.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 *
 * @returns {Promise<void>} A promise that resolves to nothing.
 *
 * @throws {HTTPError} If a request validation error occurs.
 * @throws {HTTPError} If the user is not found.
 * @throws {Error} If an internal server error occurs.
 */
export const updatePass = async (req: AuthRequest, res: Response) => {
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
}


/**
 * Grants temporary guest access to the user by creating a temporary user document, generating a JWT token, and scheduling the user deletion after 1 hour.
 *
 * Request body:
 *   - gender: string (optional)
 *   - genderPreference: string (optional)
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: {
 *       token: string,
 *       user: {
 *         id: string,
 *         username: string,
 *         isGuest: boolean,
 *         canCall: boolean,
 *         gender: string,
 *         genderPreference: string,
 *       },
 *     }
 *   - tokenInfo: {
 *       expiresIn: string,
 *     },
 *   - info: {
 *       message: string,
 *       capabilities: string[],
 *     }
 */
export const guestLogin = async (req: Request, res: Response) => {
  try {
    const { gender, genderPreference } = req.body;

    const guestId = new mongoose.Types.ObjectId();
    const guestUsername = `Guest_${crypto.randomBytes(3).toString("hex")}`;
    const guestEmail = `${guestUsername}@temporary.com`;
    const guestPassword = crypto.randomBytes(10).toString("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const guestUser = new User({
      _id: guestId,
      username: guestUsername,
      email: guestEmail,
      password: guestPassword,
      isVerified: true,
      isTemporary: true,
      expiresAt: expiresAt,
      gender: gender || "other",
      genderPreference: genderPreference || "any",
    });

    await guestUser.save();

    const token = jwt.sign(
      {
        _id: guestId,
        username: guestUsername,
        isGuest: true,
        canCall: true,
        gender: gender || "other",
        genderPreference: genderPreference || "any",
      },
      config.JWT_SECRET,
      { expiresIn: "1h" },
    );

    // Schedule user deletion
    setTimeout(
      async () => {
        try {
          await User.findByIdAndDelete(guestId);
          console.log(`Temporary user ${guestUsername} has been deleted.`);
        } catch (error) {
          console.error(
            `Error deleting temporary user ${guestUsername}:`,
            error,
          );
        }
      },
      60 * 60 * 1000,
    ); // 1 hour

    res.json({
      success: true,
      message: "Guest access granted",
      data: {
        token,
        user: {
          id: guestId,
          username: guestUsername,
          isGuest: true,
          canCall: true,
          gender: gender || "other",
          genderPreference: genderPreference || "any",
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
}

  /**
   * Updates the user's preference for gender in calls.
   *
   * Request body:
   *   - genderPreference: string (optional)
   *
   * Response:
   *   - success: boolean
   *   - message: string
   *   - data: {
   *       genderPreference: string,
   *     }
   *
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   *
   * @returns {Promise<void>} A promise that resolves to nothing.
   *
   * @throws {Error} If an internal server error occurs.
   * @throws {HTTPError} If the user is not found.
   */
export const updatePreference = async (req: AuthRequest, res: Response) => {
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
}

  /**
   * Handles password reset process by validating input, finding the user, generating a password reset token,
   * saving the token and expiry to the user document, sending a password reset email, and returning a success message.
   *
   * Request body:
   *   - email: string
   *
   * Response:
   *   - success: boolean
   *   - message: string
   *   - errors: {
   *       email: string,
   *     }
   *   - error: string (only in development mode)
   *
   * @throws {HTTPError} If the input is invalid or the user is not found.
   * @throws {Error} If an internal server error occurs.
   */
export const forgotPassword = async (req: Request, res: Response) => {
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
    await sendPasswordResetEmail(user.email, user.username, resetToken);

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
}

  /**
   * Deletes the user account permanently.
   *
   * Request body:
   *   - none
   *
   * Response:
   *   - success: boolean
   *   - message: string
   *   - data: {
   *       userId: string,
   *       username: string,
   *       email: string,
   *       deletedAt: string,
   *     }
   *   - info: {
   *       message: string,
   *       nextSteps: string[],
   *     }
   *   - error: string (only in development mode)
   *
   * @throws {HTTPError} If the user is not found.
   * @throws {Error} If an internal server error occurs.
   */
export const deleteAccount = async (req: AuthRequest, res: Response) => {
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
}