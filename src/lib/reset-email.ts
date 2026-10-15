import { Resend } from "resend";

// Surfaced to the user when the password reset email cannot be delivered
export const RESET_EMAIL_SUPPORT_MESSAGE =
  "We couldn't send the password reset email. Please email support@cinderfell.vargasjr.dev and we'll get you back into your account.";

export type SendResetEmailResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the password-reset email via Resend.
 *
 * The Resend SDK reports API-level failures (invalid key, quota, invalid sender)
 * on the returned `error` object instead of throwing, so both the error object
 * and thrown network errors are inspected here and the outcome is returned to
 * the caller — nothing throws past this boundary.
 */
export async function sendResetEmail(
  to: string,
  url: string,
  name?: string | null,
): Promise<SendResetEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error(
      "[auth] RESEND_API_KEY not configured — cannot send password reset email",
    );
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const result = await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM || "Cinderfell <noreply@vargasjr.dev>",
      to,
      subject: "Reset your Cinderling password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1d4ed8;">Reset Your Password</h2>
          <p>Hi ${name || "there"},</p>
          <p>We received a request to reset your Cinderling password. Click the button below to choose a new one:</p>
          <a href="${url}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #6b7280; font-size: 14px;">— Cinderling</p>
        </div>
      `,
    });

    if (result.error) {
      console.error(
        "[auth] Resend failed to send password reset email:",
        result.error,
      );
      return { ok: false, error: result.error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("[auth] Error sending password reset email:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
