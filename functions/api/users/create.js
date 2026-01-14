import { json, bad, readJson, makePasswordRecord, requireUser } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const admin = await requireAdmin(context);
  if (admin.response) return admin.response;

  const body = await readJson(request);
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();
  const is_admin = !!body.is_admin;

  if (!username || username.length < 2) return bad(400, "username too short");
  if (!password || password.length < 10) return bad(400, "password must be at least 10 chars");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (exists) return bad(409, "username already exists");

  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

  const res = await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)"
  )
    .bind(username, rec.hash_b64, rec.salt_b64, is_admin ? 1 : 0)
    .run();

  return json({ ok: true, id: res.meta?.last_row_id ?? null, username, is_admin });
}
