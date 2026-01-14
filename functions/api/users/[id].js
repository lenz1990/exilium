import { json, bad, requireUser } from "../../_shared.js";

export async function onRequestDelete(context) {
  const { env, params } = context;

  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  if (!auth.user.is_admin) return bad(403, "Admin only");

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return bad(400, "invalid id");

  // Admin mit ID 1 schützen (wie bei dir im Hinweis)
  if (id === 1) return bad(400, "cannot delete protected user (id 1)");

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
