import { json, clearSessionCookie } from "../_shared.js";

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header.split(";")
      .map(s => s.trim())
      .filter(Boolean)
      .map(kv => {
        const i = kv.indexOf("=");
        return i === -1 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
      })
  );
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const cookies = parseCookies(request);
  const sid = cookies["__Host-exilium_session"];

  if (sid) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }

  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
