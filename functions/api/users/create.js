import {
  bad,
  json,
  readJson,
  getClientIp,
  makePasswordRecord,
  requireUser,
  rateLimit
} from "../../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const { user, response } = await requireUser(context);
  if (response) return response;
  if (!user.is_admin) return bad(403, "Admin only");

  const ip = getClientIp(request);
  const rl = await rateLimit(env, `create_user:${ip}`, 20, 300);
  if (!rl.allowed) return bad(429, "Too many attempts");

  const body = await readJson(request);
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!username || !password) return bad(400, "username and password required");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) return bad(409, "Username already exists");

  const createdAt = Math.floor(Date.now() / 1000);
  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

  await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin, created_at) VALUES (?, ?, ?, 0, ?)"
  ).bind(username, rec.hash_b64, rec.salt_b64, createdAt).run();

  return json({ ok: true, username });
}
