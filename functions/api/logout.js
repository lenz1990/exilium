import { clearSessionCookie, getUserFromSession } from "../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const user = await getUserFromSession(env, request);
  if (user?.sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(user.sessionId).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookie(),
    },
  });
}
