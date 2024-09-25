import * as React from "react";
import { Html } from "@react-email/html";
import { Button } from "@react-email/button";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";

interface VerificationEmailProps {
  url: string;
  username: string;
}

export default function VerificationEmail({
  url,
  username,
}: VerificationEmailProps) {
  return (
    <Html lang="en">
      <Section style={container}>
        <Text style={heading}>Hello {username},</Text>
        <Text style={paragraph}>
          Thank you for registering. Please verify your email address by
          clicking the button below:
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
          Verify Email Address
        </Button>

        <Text style={paragraph}>
          If you didn't request this, you can safely ignore this email.
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
