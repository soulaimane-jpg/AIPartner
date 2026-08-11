/**
 * Public OpenAPI 3.1 spec.
 *
 * Hand-maintained — we deliberately don't generate it from Zod yet
 * because:
 *   - The wire shape diverges intentionally from the storage shape
 *     (status enums, JSON-string columns, anonymisation).
 *   - The doc surface is small enough (~7 routes) that drift is
 *     trivial to catch in code review.
 *
 * Served at `/api/v1/openapi.json`. The spec object below is the
 * canonical contract — any time you touch a route handler, update
 * the corresponding fragment here in the same change.
 */

import { NextResponse } from "next/server";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import { API_SCOPES } from "@/lib/public-api/scopes";

export const runtime = "nodejs";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "AI Partner Public API",
    version: "1.0.0",
    description:
      "Programmatic access to AI Partner briefs, matches, the public partner directory, and the sub-processor registry. All authenticated endpoints require a Bearer token (`aip_live_*`). The directory and sub-processor endpoints are anonymous.",
    contact: { name: "AI Partner Support", email: "support@aipartner.example" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "https://app.aipartner.example/api/v1", description: "Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description:
          "Send your key in the `Authorization` header as `Bearer aip_live_…`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code"],
            properties: {
              code: {
                type: "string",
                enum: [
                  "INVALID_INPUT",
                  "UNAUTHENTICATED",
                  "FORBIDDEN",
                  "NOT_FOUND",
                  "CONFLICT",
                  "RATE_LIMITED",
                  "INTERNAL",
                ],
              },
              reason: { type: "string" },
              retryAfterSec: { type: "integer" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      Brief: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          stage: { type: "string" },
          status: { type: "string" },
          completion: { type: "integer", minimum: 0, maximum: 100 },
          executiveSummary: { type: "string", nullable: true },
          scopeRequirements: { type: "array", items: { type: "string" } },
          successCriteria: { type: "array", items: { type: "string" } },
          budgetRange: { type: "string", nullable: true },
          preferredLocation: { type: "string", nullable: true },
          targetGoLive: { type: "string", nullable: true },
          submittedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Match: {
        type: "object",
        properties: {
          id: { type: "string" },
          briefId: { type: "string" },
          partnerId: { type: "string" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Partner: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          tagline: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          website: { type: "string", nullable: true },
          headquarters: { type: "string", nullable: true },
          tier: { type: "string" },
          regions: { type: "array", items: { type: "string" } },
          specializations: { type: "array", items: { type: "string" } },
          industryExperience: { type: "array", items: { type: "string" } },
          certifications: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, level: { type: "string" } },
            },
          },
        },
      },
      SubProcessor: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          purpose: { type: "string" },
          region: { type: "string" },
          url: { type: "string", nullable: true },
          certifications: { type: "array", items: { type: "string" } },
          effectiveFrom: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  "x-api-scopes": API_SCOPES,
  "x-webhook-events": WEBHOOK_EVENTS,
  paths: {
    "/briefs": {
      get: {
        summary: "List briefs",
        tags: ["Briefs"],
        parameters: [
          { in: "query", name: "stage", schema: { type: "string" } },
          { in: "query", name: "status", schema: { type: "string" } },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { in: "query", name: "cursor", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Brief" } },
                    nextCursor: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "Create a brief",
        tags: ["Briefs"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  executiveSummary: { type: "string" },
                  services: { type: "array", items: { type: "string" } },
                  budgetRange: { type: "string" },
                  preferredLocation: { type: "string" },
                  targetGoLive: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Brief" } } } } } },
          "422": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/briefs/{id}": {
      get: {
        summary: "Get a brief",
        tags: ["Briefs"],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Brief" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/matches/{id}": {
      get: {
        summary: "Get a match",
        tags: ["Matches"],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Match" } } } } } },
        },
      },
      patch: {
        summary: "Update a match (accept/decline)",
        tags: ["Matches"],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["ACCEPTED", "DECLINED"] },
                  declineReason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated" },
          "409": { description: "State conflict" },
        },
      },
    },
    "/partners": {
      get: {
        summary: "List public partners",
        tags: ["Directory"],
        security: [],
        parameters: [
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "region", schema: { type: "string" } },
          { in: "query", name: "industry", schema: { type: "string" } },
          { in: "query", name: "specialization", schema: { type: "string" } },
          { in: "query", name: "tier", schema: { type: "string" } },
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "cursor", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    partners: { type: "array", items: { $ref: "#/components/schemas/Partner" } },
                    nextCursor: { type: "string", nullable: true },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/sub-processors": {
      get: {
        summary: "List sub-processors",
        tags: ["Trust"],
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/SubProcessor" } },
                    retrievedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=60",
    },
  });
}
