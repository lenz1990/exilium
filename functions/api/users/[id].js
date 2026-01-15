import { json, bad, readJson, requireUser, makePasswordRecord } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

function getId(context) {
  const id = Number(context.params?.id);
  return Number.isFinite(id) ? id : NaN;
}

export async function onRequestGet(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const id = getId(context);
  if (!Number.isFinite(id) || id <= 0) return bad(400, "invalid id");

  const u = await context.env.DB
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .bind(id)
    .first();

  if (!u) return bad(404, "user not found");
  return json({ ok: true, user: { id: u.id, username: u.username, is_admin: !!u.is_admin }});
}

export async function onRequestDelete(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const id = getId(context);
  if (!Number.isFinite(id) || id <= 0) return bad(400, "invalid id");
  if (id === gate.user.id) return bad(400, "cannot delete your own account");

  await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  const del = await context.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();

  const changed = (del?.meta?.changes ?? 0);
  if (changed === 0) return bad(404, "user not found");

  return json({ ok: true });
}

export async function onRequestPatch(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const id = getId(context);
  if (!Number.isFinite(id) || id <= 0) return bad(400, "invalid id");

  const body = await readJson(context.request);

  const doAdmin = Object.prototype.hasOwnProperty.call(body, "is_admin");
  const doPass = Object.prototype.hasOwnProperty.call(body, "password");

  if (!doAdmin && !doPass) return bad(400, "nothing to update");

  if (doAdmin && id === gate.user.id) return bad(400, "cannot change your own admin flag here");

  if (doPass) {
    const password = String(body.password || "");
    if (!password || password.length < 10) return bad(400, "password must be at least 10 chars");

    const rec = await makePasswordRecord(password, context.env.PASSWORD_PEPPER || "");
    await context.env.DB
      .prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
      .bind(rec.hash_b64, rec.salt_b64, id)
      .run();

    await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }

  if (doAdmin) {
    await context.env.DB
      .prepare("UPDATE users SET is_admin = ? WHERE id = ?")
      .bind(body.is_admin ? 1 : 0, id)
      .run();
  }

  return json({ ok: true });
}
