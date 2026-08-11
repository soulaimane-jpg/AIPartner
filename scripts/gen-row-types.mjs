/**
 * One-off generator: db/schema.sql (CREATE TABLE DDL) → src/lib/db/rows.ts
 * TypeScript row interfaces for the pg data layer.
 *
 *   node scripts/gen-row-types.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const ddl = readFileSync("db/schema.sql", "utf8");

const TYPE_MAP = [
  [/^TIMESTAMP/, "Date"],
  [/^TEXT/, "string"],
  [/^VARCHAR/, "string"],
  [/^CHAR/, "string"],
  [/^BOOLEAN/, "boolean"],
  [/^INTEGER/, "number"],
  [/^SMALLINT/, "number"],
  [/^DOUBLE/, "number"],
  [/^REAL/, "number"],
  [/^BIGINT/, "string"], // pg returns int8 as string
  [/^DECIMAL|^NUMERIC/, "string"],
  [/^JSONB|^JSON/, "unknown"],
  [/^DATE/, "Date"],
];

function tsType(sqlType) {
  for (const [re, ts] of TYPE_MAP) if (re.test(sqlType)) return ts;
  throw new Error(`Unmapped SQL type: ${sqlType}`);
}

const tables = [...ddl.matchAll(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g)];
let out = `/**
 * Row types for every table — generated from db/schema.sql by
 * scripts/gen-row-types.mjs. Regenerate after DDL changes.
 */

/* eslint-disable */

`;

for (const [, table, body] of tables) {
  out += `export interface ${table}Row {\n`;
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    const m = line.match(/^"(\w+)" ([A-Z0-9()]+(?: PRECISION)?)(.*)$/);
    if (!m) continue; // constraints etc.
    const [, col, sqlType, rest] = m;
    const nullable = !/NOT NULL/.test(rest);
    out += `  ${col}: ${tsType(sqlType)}${nullable ? " | null" : ""};\n`;
  }
  out += `}\n\n`;
}

writeFileSync("src/lib/db/rows.ts", out);
console.log(`Generated ${tables.length} row interfaces -> src/lib/db/rows.ts`);
