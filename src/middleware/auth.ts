import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    isGuest?: boolean;
    canCall?: boolean;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, config.JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = {
      _id: user._id,
      isGuest: user.isGuest || false,
      canCall: user.isGuest || !user.isGuest, // Both guests and regular users can call
    };
    next();
  });
};

export const canChat = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.isGuest) {
    return res.status(403).json({
      success: false,
      message:
        "Chat feature is not available for guest users. Please register for full access.",
    });
  }
  next();
};

export const canCall = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.canCall) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to make calls.",
    });
  }
  next();
};

export const authenticateNonGuestToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  authenticateToken(req, res, () => {
    if (req.user?.isGuest) {
      return res.status(403).json({
        success: false,
        message: "This action is not allowed for guest users",
      });
    }
    next();
  });
};
