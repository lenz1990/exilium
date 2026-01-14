import {
  bad,
  readJson,
  getClientIp,
  verifyPassword,
  createSession,
  setSessionCookie,
  rateLimit
} from "../_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  const ip = getClientIp(request);
  const rl = await rateLimit(env, `login:${ip}`, 10, 300);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: "Too many attempts" }), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(rl.retryAfter || 60),
      },
    });
  }

  const body = await readJson(request);
  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!username || !password) return bad(400, "username and password required");

  const user = await env.DB.prepare(
    "SELECT id, username, password_hash, salt, is_admin FROM users WHERE username = ?"
  ).bind(username).first();

  if (!user) return bad(401, "Invalid username or password");

  const ok = await verifyPassword(password, user.salt, user.password_hash, env.PASSWORD_PEPPER || "");
  if (!ok) return bad(401, "Invalid username or password");

  const sid = await createSession(env, user.id);

  return new Response(JSON.stringify({ ok: true, username: user.username, is_admin: !!user.is_admin }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": setSessionCookie(sid),
    },
  });
}
