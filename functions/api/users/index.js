import {
  json,
  bad,
  readJson,
  requireUser,
  makePasswordRecord,
  rateLimit,
  getClientIp,
} from "../../_shared.js";

export async function onRequestGet(context) {
  const { env } = context;

  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  if (!auth.user.is_admin) return bad(403, "Admin only");

  const res = await env.DB.prepare(
    "SELECT id, username, is_admin FROM users ORDER BY id ASC"
  ).all();

  return json({ ok: true, users: res.results || [] });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  if (!auth.user.is_admin) return bad(403, "Admin only");

  // Rate limit (pro IP)
  const ip = getClientIp(request);
  const rl = await rateLimit(env, `admin_create_user:${ip}`, 20, 300);
  if (!rl.allowed) return bad(429, "Too many attempts");

  const body = await readJson(request);
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();
  const is_admin = body.is_admin ? 1 : 0;

  if (!username) return bad(400, "username required");
  if (username.length < 2 || username.length > 32) return bad(400, "username must be 2-32 chars");
  if (!password) return bad(400, "password required");
  if (password.length < 10) return bad(400, "password must be at least 10 chars");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (exists) return bad(409, "username already exists");

  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

  const ins = await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)"
  )
    .bind(username, rec.hash_b64, rec.salt_b64, is_admin)
    .run();

  const newId = ins?.meta?.last_row_id;
  let created = null;

  if (newId) {
    created = await env.DB.prepare(
      "SELECT id, username, is_admin FROM users WHERE id = ?"
    ).bind(newId).first();
  } else {
    // Fallback, falls last_row_id nicht da ist
    created = await env.DB.prepare(
      "SELECT id, username, is_admin FROM users WHERE username = ?"
    ).bind(username).first();
  }

  return json({ ok: true, user: created });
}
