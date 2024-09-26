import { Router } from "express";
import { checkLoginToken, deleteAccount, forgotPassword, getUserId, guestLogin, loginUser, logoutUser, register, updatePass, updatePreference, verifyEmailToken } from '../controllers/authController';
import { authenticateNonGuestToken, authenticateToken } from "../middleware/auth";

const router = Router();

// Auth routes
router.post("/register", register);
router.post("/login", loginUser);
router.post("/logout", authenticateToken, logoutUser);
router.post("/guest-access", guestLogin);

// Token verification routes
router.get("/verify/:token", verifyEmailToken);
router.post("/check-token", checkLoginToken);


// User routes
router.get("/user/:username", authenticateToken, getUserId
);
router.put("/updatepassword", authenticateNonGuestToken, updatePass
);
router.put(
  "/update-preferences", authenticateToken, updatePreference,
);
router.post("/forgot-password", forgotPassword);
router.delete(
  "/deleteuser",
  authenticateToken,
  deleteAccount
);






export default router;
