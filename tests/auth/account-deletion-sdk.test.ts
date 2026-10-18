import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createDeletionHandler } from "../../supabase/functions/delete-account/handler";

let server: Server, url: string;
const calls: { method?: string; path: string; body: string }[] = [];
beforeAll(async () => {
  server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const path = request.url!;
    calls.push({ method: request.method, path, body });
    response.setHeader("content-type", "application/json");
    if (
      path === "/auth/v1/user" ||
      path === "/auth/v1/admin/users/50000000-0000-4000-8000-000000000001"
    )
      return response.end(
        JSON.stringify({
          id: "50000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        }),
      );
    if (path === "/auth/v1/.well-known/jwks.json")
      return response.end('{"keys":[]}');
    if (path === "/rest/v1/rpc/consume_account_request")
      return response.end(
        JSON.stringify({ allowed: true, retryAfterSeconds: 0 }),
      );
    if (path === "/rest/v1/rpc/account_session_active")
      return response.end("true");
    if (path === "/auth/v1/logout?scope=global") {
      response.statusCode = 204;
      return response.end();
    }
    response.statusCode = 404;
    response.end('{"error":"Unexpected local fixture request"}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture port unavailable");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it("executes the deletion protocol through the installed SDK using only a local synthetic identity", async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "50000000-0000-4000-8000-000000000001",
      iss: `${url}/auth/v1`,
      aud: "authenticated",
      role: "authenticated",
      exp: now + 3600,
      iat: now,
      session_id: "60000000-0000-4000-8000-000000000001",
      amr: [{ method: "oauth", timestamp: now }],
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const token = `${unsigned}.${createHmac("sha256", "local-test-only").update(unsigned).digest("base64url")}`;
  const handle = createDeletionHandler((authorization) => {
    const auth = {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    };
    return {
      user: createClient(url, "sb_publishable_local_fixture_only", {
        auth,
        global: { headers: { Authorization: authorization } },
      }),
      admin: createClient(url, "sb_secret_local_fixture_only", { auth }),
    };
  });
  const response = await handle(
    new Request(`${url}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deleted: true });
  const signout = calls.findIndex(
    (call) =>
      call.method === "POST" && call.path === "/auth/v1/logout?scope=global",
  );
  const deletion = calls.findIndex(
    (call) =>
      call.method === "DELETE" &&
      call.path === "/auth/v1/admin/users/50000000-0000-4000-8000-000000000001",
  );
  expect(signout).toBeGreaterThan(-1);
  const admission = calls.findIndex(
    (call) => call.path === "/rest/v1/rpc/consume_account_request",
  );
  expect(admission).toBeGreaterThan(-1);
  expect(admission).toBeLessThan(signout);
  expect(JSON.parse(calls[admission].body)).toEqual({ p_bucket: "delete" });
  expect(deletion).toBeGreaterThan(signout);
  expect(JSON.parse(calls[deletion].body)).toEqual({
    should_soft_delete: false,
  });
});
