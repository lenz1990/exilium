import { json, bad, readJson, requireUser, makePasswordRecord } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

// reset = "set-password + delete sessions"
export async function onRequestPost(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const body = await readJson(context.request);
  const id = Number(body.id);
  const password = String(body.password || "");

  if (!Number.isFinite(id) || id <= 0) return bad(400, "valid id required");
  if (!password) return bad(400, "password required");
  if (password.length < 10) return bad(400, "password must be at least 10 chars");

  const rec = await makePasswordRecord(password, context.env.PASSWORD_PEPPER || "");

  const upd = await context.env.DB
    .prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
    .bind(rec.hash_b64, rec.salt_b64, id)
    .run();

  const changed = (upd?.meta?.changes ?? 0);
  if (changed === 0) return bad(404, "user not found");

  await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();

  return json({ ok: true });
}
