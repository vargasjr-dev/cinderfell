/**
 * POST /api/forgot-password
 *
 * Sends the password-reset email, owning the HTTP contract for the
 * forgot-password page. better-auth's own /api/auth/request-password-reset
 * endpoint cannot surface send failures — its runInBackgroundOrAwait wrapper
 * catches and logs every callback error, so the endpoint always answers 200
 * even when the email never went out. The page posts here instead to learn
 * the real outcome.
 *
 * Body: { email: string, redirectTo?: string }
 * Responses:
 * - 200 { status: true, message } — email sent, or the email is unknown
 *   (identical response either way to avoid account enumeration)
 * - 400 { message } — malformed request
 * - 500 { message: RESET_EMAIL_SUPPORT_MESSAGE } — the reset email failed to send
 *
 * Token rows are created in better-auth's exact format
 * (identifier `reset-password:<token>`, value = user id, 1-hour expiry) so
 * better-auth's reset-password GET callback and POST endpoints keep working.
 */

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth.server";
import { getBaseUrl } from "../../../lib/app-url";
import {
  RESET_EMAIL_SUPPORT_MESSAGE,
  sendResetEmail,
} from "../../../lib/reset-email";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const redirectTo =
    typeof body?.redirectTo === "string" ? body.redirectTo : "/reset-password";

  if (!email) {
    return NextResponse.json({ message: "Email is required" }, { status: 400 });
  }

  const authContext = await auth.$context;
  const user = await authContext.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });

  if (!user) {
    // Anti-enumeration: mirror better-auth's dummy token generation and lookup
    // to keep timing consistent, then respond identically to the success case.
    await authContext.internalAdapter.findVerificationValue(
      "dummy-verification-token",
    );
    console.error("[auth] Reset Password: User not found", { email });
    return NextResponse.json({
      status: true,
      message:
        "If this email exists in our system, check your email for the reset link",
    });
  }

  const token = randomUUID();
  await authContext.internalAdapter.createVerificationValue({
    value: user.user.id,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour, matching the email copy
  });

  const resetUrl = `${getBaseUrl()}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(redirectTo)}`;

  const outcome = await sendResetEmail(
    user.user.email,
    resetUrl,
    user.user.name,
  );
  if (!outcome.ok) {
    return NextResponse.json(
      { message: RESET_EMAIL_SUPPORT_MESSAGE },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: true,
    message:
      "If this email exists in our system, check your email for the reset link",
  });
}
