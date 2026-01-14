import { json, clearSessionCookie, getUserFromSession } from "../_shared.js";

export async function onRequestPost({ env, request }) {
  const u = await getUserFromSession(env, request);
  if (u?.sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(u.sessionId).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": clearSessionCookie(),
    },
  });
}
