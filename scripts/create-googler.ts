import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const email = "demo.googler@google.com";
  const name = "Alex Chen";
  const password = "Googler-Demo-2026!";
  const hash = await bcrypt.hash(password, 10);

  const existing = await pool.query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "email" = $1',
    [email],
  );
  if (existing.rows[0]) {
    // Reset password so the user always has known credentials.
    await pool.query(
      'UPDATE "User" SET "passwordHash" = $1, "role" = \'GOOGLER\', "updatedAt" = NOW() WHERE "id" = $2',
      [hash, existing.rows[0].id],
    );
    console.log("Updated existing Googler account:");
  } else {
    await pool.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "jobTitle", "location", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'GOOGLER', $5, $6, NOW(), NOW())`,
      [
        randomUUID(),
        email,
        name,
        hash,
        "Google Sales Representative",
        "Amsterdam, NL",
      ],
    );
    console.log("Created new Googler account:");
  }

  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  sign in:  http://localhost:3000/auth/sign-in`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
