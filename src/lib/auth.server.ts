import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "../../data/db";

// Only configure Google OAuth if credentials are provided
const socialProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
  : undefined;

// Configure Resend for transactional emails if API key is present
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // Cannot be set during signup
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        console.error("[auth] RESEND_API_KEY not configured — cannot send password reset email");
        return;
      }

      try {
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM || "Cinderling <noreply@vellymon.game>",
          to: user.email,
          subject: "Reset your Cinderling password",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1d4ed8;">Reset Your Password</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>We received a request to reset your Cinderling password. Click the button below to choose a new one:</p>
            <a href="${url}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 14px;">— Cinderling</p>
          </div>
        `,
        });
        void result; // success
      } catch (err) {
        console.error("[auth] Error sending password reset email:", err);
      }
    },
  },
  ...(socialProviders && { socialProviders }),
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
