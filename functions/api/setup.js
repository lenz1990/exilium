import { json, bad, readJson, makePasswordRecord } from "../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const body = await readJson(request);
  const setupKey = (body.setupKey || "").trim();
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!setupKey || !username || !password) return bad(400, "setupKey, username, password required");
  if ((env.SETUP_KEY || "") !== setupKey) return bad(403, "Invalid setup key");
  if (username.length < 3) return bad(400, "Username too short");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  const hasAdmin = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin = 1").first();
  if ((hasAdmin?.c || 0) > 0) return bad(409, "Admin already exists");

  const pepper = env.PASSWORD_PEPPER || "";
  const rec = await makePasswordRecord(password, pepper);

  const createdAt = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt, created_at, is_admin) VALUES (?, ?, ?, ?, 1)"
    )
      .bind(username, rec.hash_b64, rec.salt_b64, createdAt)
      .run();
  } catch (e) {
    return bad(400, "Username already exists (or DB error)");
  }

  return json({ ok: true });
}
