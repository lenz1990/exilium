import { json, bad, readJson, getClientIp, makePasswordRecord, createSession, setSessionCookie, rateLimit } from "../_shared.js";

export async function onRequestGet(context) {
  const row = await context.env.DB.prepare("SELECT COUNT(1) as c FROM users WHERE is_admin = 1").first();
  const c = Number(row?.c || 0);
  return json({ ok: true, needs_setup: c === 0 });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  const ip = getClientIp(request);
  const rl = await rateLimit(env, `setup:${ip}`, 10, 300);
  if (!rl.allowed) return bad(429, "Too many attempts");

  const row = await env.DB.prepare("SELECT COUNT(1) as c FROM users WHERE is_admin = 1").first();
  const c = Number(row?.c || 0);
  if (c > 0) return bad(409, "Already set up");

  const body = await readJson(request);
  const setupKey = (body.setupKey || "").trim();
  const username = (body.username || "").trim();
  const password = (body.password || "");

  if (!setupKey || !username || !password) return bad(400, "setupKey, username, password required");
  if (!env.SETUP_KEY) return bad(500, "SETUP_KEY not configured");
  if (setupKey !== env.SETUP_KEY) return bad(401, "Invalid setup key");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  const pr = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");
  const created = Math.floor(Date.now() / 1000);

  const ins = await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin, created_at) VALUES (?, ?, ?, 1, ?)"
  )
    .bind(username, pr.hash_b64, pr.salt_b64, created)
    .run();

  const userId = ins.meta.last_row_id;

  const sid = await createSession(env, userId);

  return json(
    { ok: true, username, is_admin: true },
    { headers: { "set-cookie": setSessionCookie(sid) } }
  );
}
