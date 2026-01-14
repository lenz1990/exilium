import { bad, readJson, makePasswordRecord, requireUser, json } from "../../_shared.js";

export async function onRequestPost(context) {
  const { env } = context;

  const { user, response } = await requireUser(context);
  if (response) return response;

  if (!user.is_admin) return bad(403, "Admin only");

  const body = await readJson(context.request);
  const username = (body.username || "").trim();
  const password = (body.password || "");

  if (!username || !password) return bad(400, "username and password required");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) return bad(409, "Username already exists");

  const pr = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");
  const created = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin, created_at) VALUES (?, ?, ?, 0, ?)"
  )
    .bind(username, pr.hash_b64, pr.salt_b64, created)
    .run();

  return json({ ok: true });
}
