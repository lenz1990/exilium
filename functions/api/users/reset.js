import {
  bad,
  readJson,
  makePasswordRecord,
  requireUser,
  json
} from "../_shared.js";

export async function onRequestPost(context) {
  const { env } = context;

  // eingeloggt?
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  // admin?
  if (!auth.user?.is_admin) return bad(403, "Admin only");

  const body = await readJson(context.request);

  const id = Number(body.id ?? body.user_id ?? 0) || null;
  const username = (body.username ?? "").trim();

  const newPassword = String(body.new_password ?? body.password ?? "").trim();
  const invalidate = body.invalidate_sessions !== false; // default true

  if (!id && !username) return bad(400, "id or username required");
  if (!newPassword || newPassword.length < 10) return bad(400, "password must be at least 10 chars");

  // Ziel-User finden (per id oder username)
  let target = null;

  if (id) {
    target = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?")
      .bind(id)
      .first();
  } else {
    target = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
      .bind(username)
      .first();
  }

  if (!target) return bad(404, "User not found");

  // neues Passwort record
  const rec = await makePasswordRecord(newPassword, env.PASSWORD_PEPPER || "");

  // Update in DB
  const res = await env.DB.prepare(
    "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?"
  )
    .bind(rec.hash_b64, rec.salt_b64, target.id)
    .run();

  // Wenn nichts geändert wurde -> User existiert nicht (oder gleiches Resultat)
  if (res?.meta?.changes === 0) return bad(404, "User not found");

  // Optional: Sessions killen (User wird ausgeloggt)
  if (invalidate) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id).run();
  }

  return json({
    ok: true,
    user: { id: target.id, username: target.username },
    sessions_invalidated: invalidate
  });
}
