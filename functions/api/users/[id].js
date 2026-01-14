import { json, bad, requireUser } from "../../_shared.js";

export async function onRequestDelete(context) {
  const { env, params } = context;

  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  if (!auth.user.is_admin) return bad(403, "Admin only");

  const idRaw = String(params.id || "").trim();
  const userId = Number(idRaw);
  if (!Number.isInteger(userId) || userId <= 0) return bad(400, "Invalid user id");

  // Sicherheits-Guards
  if (userId === auth.user.id) return bad(400, "You cannot delete your own account");
  if (userId === 1) return bad(400, "User #1 cannot be deleted");

  const exists = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
  if (!exists) return bad(404, "User not found");

  // Sessions vom User entfernen, dann User löschen
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

  return json({ ok: true });
}
