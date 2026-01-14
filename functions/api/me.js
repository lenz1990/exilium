import { json, getUserFromSession } from "../_shared.js";

export async function onRequestGet(context) {
  const user = await getUserFromSession(context.env, context.request);

  // Nicht eingeloggt => klarer 401, ok:false
  if (!user) {
    return json({ ok: false, user: null }, { status: 401 });
  }

  // Eingeloggt => ok:true + user
  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
    },
  });
}
