const encoder = new TextEncoder();

const COOKIE_NAME = "__Host-exilium_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";
const HASH_BYTES = 32;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
    status: init.status ?? 200,
  });
}

function bad(status, message) {
  return json({ ok: false, error: message }, { status });
}

async function readJson(request, maxBytes = 50_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Body too large");
  if (!text) return {};
  return JSON.parse(text);
}

function base64FromBytes(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}
function bytesFromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64UrlFromBytes(bytes) {
  return base64FromBytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const parts = header.split(";").map((p) => p.trim()).filter(Boolean);
  const cookies = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    cookies[k] = v;
  }
  return cookies;
}

function setSessionCookie(sessionId) {
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}
function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

async function pbkdf2Hash(password, saltBytes, pepper) {
  const passBytes = encoder.encode(`${password}${pepper || ""}`);
  const key = await crypto.subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

async function makePasswordRecord(password, pepper) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2Hash(password, salt, pepper);
  return { salt_b64: base64FromBytes(salt), hash_b64: base64FromBytes(hash) };
}

async function verifyPassword(password, salt_b64, hash_b64, pepper) {
  const salt = bytesFromBase64(salt_b64);
  const expected = bytesFromBase64(hash_b64);
  const actual = await pbkdf2Hash(password, salt, pepper);
  return constantTimeEqualBytes(actual, expected);
}

async function rateLimit(env, key, limit, windowSeconds) {
  const now = nowSec();
  const row = await env.DB.prepare("SELECT key, count, reset_at FROM rate_limits WHERE key = ?")
    .bind(key)
    .first();

  if (!row) {
    await env.DB.prepare("INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)")
      .bind(key, 1, now + windowSeconds)
      .run();
    return { allowed: true, remaining: limit - 1 };
  }

  if (now >= row.reset_at) {
    await env.DB.prepare("UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ?")
      .bind(1, now + windowSeconds, key)
      .run();
    return { allowed: true, remaining: limit - 1 };
  }

  if (row.count >= limit) return { allowed: false, remaining: 0, retryAfter: row.reset_at - now };

  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return { allowed: true, remaining: Math.max(0, limit - (row.count + 1)) };
}

async function createSession(env, userId) {
  const sidBytes = new Uint8Array(32);
  crypto.getRandomValues(sidBytes);
  const sid = base64UrlFromBytes(sidBytes);

  const created = nowSec();
  const expires = created + SESSION_TTL_SECONDS;

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(sid, userId, created, expires)
    .run();

  return sid;
}

async function getUserFromSession(env, request) {
  const cookies = parseCookies(request);
  const sid = cookies[COOKIE_NAME];
  if (!sid) return null;

  const now = nowSec();

  const sess = await env.DB.prepare(
    `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username, u.is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  )
    .bind(sid)
    .first();

  if (!sess) return null;
  if (now >= sess.expires_at) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }

  return { sessionId: sess.session_id, id: sess.user_id, username: sess.username, is_admin: !!sess.is_admin };
}

async function requireUser(context) {
  const user = await getUserFromSession(context.env, context.request);
  if (!user) return { user: null, response: bad(401, "Not logged in") };
  return { user, response: null };
}

export {
  json,
  bad,
  readJson,
  getClientIp,
  makePasswordRecord,
  verifyPassword,
  createSession,
  getUserFromSession,
  requireUser,
  setSessionCookie,
  clearSessionCookie,
  rateLimit,
};
