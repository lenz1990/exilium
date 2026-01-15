import { bad, readJson, requireUser, makePasswordRecord } from "../../_shared.js";

async function resolveUser(context) {
  const { env, request } = context;

  // Try a few likely signatures (robust gegen Änderungen in _shared.js)
  const attempts = [
    () => requireUser(context),
    () => requireUser(env, request),
    () => requireUser(request, env),
    () => requireUser(request),
  ];

  for (const fn of attempts) {
    try {
      const out = await fn();
      if (out) return out;
    } catch (_) {}
  }
  return null;
}

export async function onRequestPost(context) {
  const { env, request } = context;

  // --- Auth / Admin check ---
  const auth = await resolveUser(context);
  if (auth instanceof Response) return auth;

  // Manche Implementationen geben { ok:true, user:{...} } zurück, andere direkt user
  const me = auth?.user ?? auth;
  if (!me?.id) return bad(401, "Not logged in");
  if (!me?.is_admin) return bad(403, "Admin only");

  // --- Input ---
  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "").trim();
  const is_admin = !!body?.is_admin; // darf fehlen → default false

  if (!username || !password) return bad(400, "username and password required");
  if (password.length < 10) return bad(400, "Password must be at least 10 characters");

  // --- Uniqueness ---
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) return bad(409, "Username already exists");

  // --- Hash/Salt via shared helper (muss zur verifyPassword-Logik passen) ---
  let rec = null;
  try {
    rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");
  } catch (e) {
    return bad(500, "Password hashing failed");
  }
  if (!rec?.password_hash || !rec?.salt) return bad(500, "Password hashing failed");

  // --- Insert ---
  try {
    const r = await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)"
    )
      .bind(username, rec.password_hash, rec.salt, is_admin ? 1 : 0)
      .run();

    const id = r?.meta?.last_row_id ?? null;

    return new Response(JSON.stringify({ ok: true, id, username, is_admin }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    const msg = String(e?.message || e);

    // typische SQLite/D1 Fehler sauber als 409 statt 500
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return bad(409, "Username already exists");
    }

    return bad(500, `DB error: ${msg}`);
  }
}
