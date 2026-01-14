import { json, bad, readJson, requireUser, makePasswordRecord } from "../../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const { user, response } = await requireUser(context);
  if (response) return response;
  if (!user.is_admin) return bad(403, "Admin only");

  const body = await readJson(request);
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!username || !password) return bad(400, "username and password required");
  if (username.length < 3) return bad(400, "Username too short");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");
  const createdAt = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt, created_at, is_admin) VALUES (?, ?, ?, ?, 0)"
    )
      .bind(username, rec.hash_b64, rec.salt_b64, createdAt)
      .run();
  } catch (e) {
    return bad(400, "Username already exists (or DB error)");
  }

  return json({ ok: true });
}
