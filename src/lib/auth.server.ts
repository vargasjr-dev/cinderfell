import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../../data/db";
import { sendResetEmail } from "./reset-email";

// Only configure Google OAuth if credentials are provided
const socialProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
  : undefined;

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
    // better-auth swallows errors thrown from this callback (its
    // runInBackgroundOrAwait wrapper logs and discards every rejection), so the
    // UI's forgot-password flow posts to /api/forgot-password instead — that
    // route owns the send and its HTTP contract. This delegate keeps
    // better-auth's own /api/auth/request-password-reset endpoint functional.
    sendResetPassword: async ({ user, url }) => {
      await sendResetEmail(user.email, url, user.name);
    },
  },
  ...(socialProviders && { socialProviders }),
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
