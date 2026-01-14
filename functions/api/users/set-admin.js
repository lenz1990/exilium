import { json, bad, readJson, requireUser } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const admin = await requireAdmin(context);
  if (admin.response) return admin.response;

  const body = await readJson(request);
  const user_id = Number(body.user_id);
  const is_admin = !!body.is_admin;

  if (!user_id) return bad(400, "user_id required");

  await env.DB.prepare("UPDATE users SET is_admin = ? WHERE id = ?")
    .bind(is_admin ? 1 : 0, user_id)
    .run();

  return json({ ok: true });
}
