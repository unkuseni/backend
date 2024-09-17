import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';

import config from '../config';
import User from '../models/user';
import { authenticateToken } from '../middleware/auth';


export interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
  };
}

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const user = new User({
      username,
      email,
      password,
      verificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    await user.save();
    res.status(201).json({ message: "User created successfully. Please check your email to verify your account." });
  } catch (error) {
    res.status(500).json({ message: "Error creating user" });
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
      return res.status(400).json({ message: "Invalid or expired verification token" });
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



router.get('/user/:username', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('_id username');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ _id: user._id, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ _id: user._id }, config.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
});

router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  // In a token-based authentication system without server-side sessions,
  // the actual "logout" happens on the client-side by removing the token.
  // Here, we're just acknowledging the logout request.

  res.status(200).json({ message: 'Logout successful' });

  // Optionally, you could implement a token blacklist here
  // to invalidate the token on the server-side as well.
});


router.put("/updatepassword", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error });
  }
});

router.delete('/deleteuser', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    // Find the user and delete
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

export default router