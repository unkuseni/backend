import * as React from "react";
import { Html } from "@react-email/html";
import { Button } from "@react-email/button";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";

interface PasswordResetEmailProps {
  url: string;
  username: string;
}

export default function PasswordResetEmail({
  url,
  username,
}: PasswordResetEmailProps) {
  return (
    <Html lang="en">
      <Section style={container}>
        <Text style={heading}>Hello {username},</Text>
        <Text style={paragraph}>
          We received a request to reset your password. If you didn't make this
          request, you can ignore this email.
        </Text>
        <Text style={paragraph}>
          To reset your password, click the button below:
        </Text>
        <Button
          style={{
            ...button,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 12,
            paddingBottom: 12,
          }}
          href={url}
        >
          Reset Password
        </Button>

        <Text style={paragraph}>
          This link will expire in 1 hour for security reasons.
        </Text>
        <Text style={footer}>
          Best regards,
          <br />
          Your App Team
        </Text>
      </Section>
    </Html>
  );
}

const container: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  padding: "20px",
  fontFamily: "Arial, sans-serif",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "20px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "20px",
};

const button: React.CSSProperties = {
  backgroundColor: "#5469d4",
  color: "#ffffff",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  borderRadius: "5px",
};

const footer: React.CSSProperties = {
  fontSize: "14px",
  color: "#9ca299",
  marginTop: "20px",
};
