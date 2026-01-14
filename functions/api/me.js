import { json, getUserFromSession } from "../_shared.js";

export async function onRequestGet({ env, request }) {
  const user = await getUserFromSession(env, request);
  if (!user) return json({ ok: true, user: null });
  return json({ ok: true, user: { id: user.id, username: user.username, is_admin: !!user.is_admin } });
}
