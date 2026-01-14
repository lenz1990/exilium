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
  const user_id = Number(body.user_id);
  const password = (body.password || "").trim();

  if (!user_id) return bad(400, "user_id required");
  if (!password || password.length < 10) return bad(400, "password must be at least 10 chars");

  const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?"
  )
    .bind(rec.hash_b64, rec.salt_b64, user_id)
    .run();

  // Sicherheitsbonus: alle Sessions dieses Users killen
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user_id).run();

  return json({ ok: true });
}
