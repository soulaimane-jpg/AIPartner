import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT "id", "email", "name", "role", "companyId", "googleId", "createdAt"
   FROM "User" ORDER BY "createdAt" DESC LIMIT 8`,
);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
