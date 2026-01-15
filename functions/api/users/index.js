import { json, bad, requireUser } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

export async function onRequestGet(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const rows = await context.env.DB
    .prepare("SELECT id, username, is_admin FROM users ORDER BY id ASC")
    .all();

  return json({ ok: true, users: (rows.results || []).map(u => ({
    id: u.id,
    username: u.username,
    is_admin: !!u.is_admin,
  }))});
}
