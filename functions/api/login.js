import {
  json,
  bad,
  readJson,
  getClientIp,
  verifyPassword,
  createSession,
  setSessionCookie,
  rateLimit,
} from "../_shared.js";

/**
 * Wichtig: Wir nutzen absichtlich "onRequest" (nicht onRequestPost),
 * damit Cloudflare garantiert auch POST an dieses File durchreicht.
 * Zusätzlich gibt GET eine Debug-Antwort zurück, damit du sofort siehst,
 * ob /api/login wirklich in der Function landet.
 */
export async function onRequest(context) {
  const { env, request } = context;

  // DEBUG: Wenn du diese JSON siehst, routed /api/login korrekt in die Function.
  if (request.method === "GET") {
    return json({ ok: true, route: "/api/login", hint: "POST to login", time: Date.now() });
  }

  if (request.method !== "POST") {
    return bad(405, "Method Not Allowed");
  }

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
  )
    .bind(username)
    .first();

  if (!user) return bad(401, "Invalid username or password");

  const ok = await verifyPassword(password, user.salt, user.password_hash, env.PASSWORD_PEPPER || "");
  if (!ok) return bad(401, "Invalid username or password");

  const sid = await createSession(env, user.id);

  return new Response(JSON.stringify({ ok: true, username: user.username, is_admin: !!user.is_admin }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": setSessionCookie(sid),
    },
  });
}
