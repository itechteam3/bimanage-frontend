import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "./client";
import { describeError, errorMessage, fieldErrors, friendlyText, GENERIC_ERROR, NETWORK_ERROR, PERMISSION_ERROR, SESSION_ERROR } from "./errorMessage";

const http = (status: number, message: string, data: Record<string, unknown> = {}) => new ApiError(message, status, { message, ...data });
const SAVE = "We couldn't save this product. Check your connection and try again.";

describe("errorMessage — never technical", () => {
  it.each([
    ["mock fixture text", http(404, "no fixture for POST /api/inventory/products")],
    ["status code text", http(404, "Request failed (404)")],
    ["Mongo cast error", http(400, 'Cast to ObjectId failed for value "x" at path "_id"')],
    ["stack trace", http(500, "TypeError: Cannot read properties of undefined\n at foo (app.js:10:4)")],
    ["Joi default text", http(400, '"sellingPrice" must be a number')],
    ["server error", http(500, "Internal Server Error")],
    ["a non-API error", new Error("boom")],
  ])("%s → the friendly fallback", (_, err) => {
    expect(errorMessage(err, SAVE)).toBe(SAVE);
  });

  it("maps known backend errors to clear text with a next step", () => {
    expect(errorMessage(http(409, "SKU already exists for this business"))).toMatch(/already uses this SKU/);
    expect(errorMessage(http(400, "E11000 duplicate key error collection: users index: email_1"))).toMatch(/account with this email already exists/);
    expect(errorMessage(http(403, "Access denied. Insufficient permissions"))).toBe(PERMISSION_ERROR);
    expect(errorMessage(http(403, "Something odd"))).toBe(PERMISSION_ERROR);
    expect(errorMessage(http(401, "jwt expired"))).toBe(SESSION_ERROR);
    expect(errorMessage(http(404, "Product not found"))).toMatch(/couldn't find that/);
    expect(errorMessage(new ApiError("x", 0, {}, "network"))).toBe(NETWORK_ERROR);
    expect(errorMessage(new ApiError("x", 429, { retryAfterSeconds: 120 }))).toBe("Too many attempts. Try again in 2 minutes.");
  });

  it("lets a sentence written for people through, incl. a deliberate 503", () => {
    expect(errorMessage(http(400, "Username must be at least 3 characters"))).toBe("Username must be at least 3 characters");
    expect(errorMessage(http(503, "We couldn't send the email right now. Please try again in a few minutes."))).toMatch(/couldn't send the email/);
  });

  it("says whether to offer Try again / Report a problem", () => {
    expect(describeError(http(500, "boom"))).toEqual({ message: GENERIC_ERROR, known: false, retryable: true });
    expect(describeError(new ApiError("x", 0, {}, "network"))).toMatchObject({ known: true, retryable: true });
    expect(describeError(http(409, "SKU already exists"))).toMatchObject({ known: true, retryable: false });
  });

  it("friendlyText filters plain backend sentences the same way", () => {
    expect(friendlyText("Payment was declined by your bank.")).toBe("Payment was declined by your bank.");
    expect(friendlyText("verify failed: undefined", "Fallback.")).toBe("Fallback.");
  });
});

describe("fieldErrors — validation next to the right field", () => {
  const FIELDS = ["name", "sku", "sellingPrice", "lowStockThreshold"] as const;
  it("maps Joi messages to fields in plain words", () => {
    const err = http(400, "sku is not allowed", { errors: ["sku is not allowed", "sellingPrice must be a number", "Product name is required"] });
    expect(fieldErrors(err, FIELDS)).toEqual({
      sku: "Sku can't be set here.",
      sellingPrice: "Enter a number for selling price.",
    });
  });
  it("uses the field the server names", () => {
    expect(fieldErrors(http(409, "SKU already exists", { field: "sku" }), FIELDS)).toEqual({ sku: "Another product already uses this SKU. Use a different one." });
  });
  it("ignores non-validation failures", () => {
    expect(fieldErrors(http(500, "name is required"), FIELDS)).toEqual({});
  });
});

describe("production bundle check", () => {
  const run = (files: Record<string, string>, api = "https://api.example.com/api") => {
    const dir = mkdtempSync(join(tmpdir(), "bundle-"));
    mkdirSync(join(dir, "assets"));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    try {
      execFileSync(process.execPath, ["scripts/check-bundle.mjs", dir], { env: { ...process.env, VITE_API_BASE_URL: api }, stdio: "pipe" });
      return "ok";
    } catch (e) {
      return String((e as { stderr: Buffer }).stderr);
    }
  };
  it("passes a clean bundle that calls the configured API", () => {
    expect(run({ "assets/index.js": 'const a="https://api.example.com/api";' })).toBe("ok");
  });
  it.each([
    ["mock fixture", 'x="no fixture for POST /api/inventory/products"'],
    ["localhost", 'fetch("http://localhost:5099/api/x")'],
    ["fake backend", "function installFakeBackend(){}"],
  ])("fails when it contains a %s", (_, code) => {
    expect(run({ "assets/index.js": `const a="https://api.example.com/api";${code}` })).toMatch(/bundle check failed/);
  });
  it("fails without an https API base", () => {
    expect(run({ "assets/index.js": "x" }, "http://localhost:5000/api")).toMatch(/must be an https URL/);
  });
});
