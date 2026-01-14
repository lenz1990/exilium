import { json, getUserFromSession } from "../_shared.js";

export async function onRequestGet(context) {
  const user = await getUserFromSession(context.env, context.request);
  if (!user) return json({ ok: true, user: null });
  return json({ ok: true, user: { id: user.id, username: user.username, is_admin: user.is_admin } });
}
