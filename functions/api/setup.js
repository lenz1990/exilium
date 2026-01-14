import {
  bad,
  json,
  readJson,
  getClientIp,
  makePasswordRecord,
  createSession,
  setSessionCookie,
  rateLimit
} from "../_shared.js";

export async function onRequestPost({ env, request }) {
  const ip = getClientIp(request);
  const rl = await rateLimit(env, `setup:${ip}`, 5, 600);
  if (!rl.allowed) return bad(429, "Too many attempts");

  const body = await readJson(request);
  const setupKey = (body.setupKey || "").trim();
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!setupKey || !username || !password) return bad(400, "setupKey, username, password required");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  if (!env.SETUP_KEY) return bad(500, "SETUP_KEY missing in environment");
  if (setupKey !== env.SETUP_KEY) return bad(401, "Invalid setup key");

  const existingAdmin = await env.DB
    .prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")
    .first();

  if (existingAdmin) return bad(409, "Setup already completed");

  const createdAt = Math.floor(Date.now() / 1000);
  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

  try {
    const result = await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt, is_admin, created_at) VALUES (?, ?, ?, 1, ?)"
    ).bind(username, rec.hash_b64, rec.salt_b64, createdAt).run();

    // D1 liefert lastRowId
    const userId = result.meta.last_row_id;
    const sid = await createSession(env, userId);

    return new Response(JSON.stringify({ ok: true, username, is_admin: true }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": setSessionCookie(sid),
      },
    });
  } catch (e) {
    return bad(500, "Failed to create admin (maybe username already exists)");
  }
}
