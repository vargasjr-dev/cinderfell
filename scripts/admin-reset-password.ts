/**
 * Admin reset password script — called by admin-reset-password.yml workflow.
 *
 * Usage: bun scripts/admin-reset-password.ts <email>
 *
 * Generates a secure reset token, inserts it into the verification table,
 * and prints RESET_URL=<url> for the workflow to capture.
 */

import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";
import { getBaseUrl } from "../src/lib/app-url";

const email = process.argv[2];
if (!email) {
  console.error("Usage: bun scripts/admin-reset-password.ts <email>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

// Verify the account exists
const users = await sql`SELECT id, email FROM "user" WHERE email = ${email} LIMIT 1`;
if (users.length === 0) {
  console.error(`No account found for: ${email}`);
  process.exit(1);
}

// Generate a secure 64-char hex token
const token = randomBytes(32).toString("hex");
const id = randomBytes(16).toString("hex");
const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

// Clear stale reset tokens for this email, then insert fresh one
await sql`DELETE FROM "verification" WHERE "identifier" = ${email}`;
await sql`
  INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
  VALUES (${id}, ${email}, ${token}, ${expiresAt}, NOW(), NOW())
`;

const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
console.log(`RESET_URL=${resetUrl}`);
console.log(`EMAIL=${email}`);
