import { json, bad, readJson, requireUser, makePasswordRecord } from "../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const { user, response } = await requireUser(context);
  if (response) return response;
  if (!user.is_admin) return bad(403, "Admin only");

  const body = await readJson(request);

  const userId = Number(body.userId ?? body.id ?? body.user_id ?? 0);
  const newPassword = String(body.newPassword ?? body.password ?? body.new_password ?? "").trim();
  const invalidate = body.invalidateSessions ?? body.invalidate_sessions ?? body.invalidate ?? true;

  if (!userId || !Number.isFinite(userId)) return bad(400, "userId required");
  if (newPassword.length < 10) return bad(400, "Password must be at least 10 characters");

  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
  if (!target) return bad(404, "User not found");

  const rec = await makePasswordRecord(newPassword, env.PASSWORD_PEPPER || "");

  await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
    .bind(rec.hash_b64, rec.salt_b64, userId)
    .run();

  if (invalidate) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }

  return json({ ok: true, userId, invalidated: !!invalidate });
}
