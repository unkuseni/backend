import Plunk from "@plunk/node";
import { render } from "@react-email/render";
import VerificationEmail from "./emailVerify";
import PasswordResetEmail from "./emailPasswordReset";
import config from "../config";

const plunk = new Plunk(config.PLUNK_API_KEY);

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
): Promise<boolean> {
  const verificationUrl = `${config.BASE_URL}/auth/verify/${token}`;
  const body = await render(
    VerificationEmail({ url: verificationUrl, username }),
  );

  try {
    const result = await plunk.emails.send({
      to,
      subject: "Verify Your Email Address",
      body,
    });
    console.log("Verification email sent:", result);
    return result.success;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  token: string,
): Promise<boolean> {
  const resetUrl = `${config.BASE_URL}/reset-password/${token}`;
  const body = await render(PasswordResetEmail({ url: resetUrl, username }));

  try {
    const result = await plunk.emails.send({
      to,
      subject: "Reset Your Password",
      body,
    });
    console.log("Password reset email sent:", result);
    return result.success;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}
