import { json, bad, readJson, requireUser } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

export async function onRequestPost(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const body = await readJson(context.request);
  const id = Number(body.id);

  if (!Number.isFinite(id) || id <= 0) return bad(400, "valid id required");
  if (id === gate.user.id) return bad(400, "cannot delete your own account");

  await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  const del = await context.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();

  const changed = (del?.meta?.changes ?? 0);
  if (changed === 0) return bad(404, "user not found");

  return json({ ok: true });
}
