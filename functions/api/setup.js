import {
  json,
  bad,
  readJson,
  makePasswordRecord,
  createSession,
  setSessionCookie,
} from "../_shared.js";

async function getUserTableColumns(DB) {
  const r = await DB.prepare("PRAGMA table_info(users)").all();
  const cols = (r?.results || []).map((x) => x.name);
  return new Set(cols);
}

function pickCol(colSet, candidates) {
  for (const c of candidates) if (colSet.has(c)) return c;
  return null;
}

export async function onRequestPost(context) {
  try {
    const env = context.env;
    const DB = env.DB;
    if (!DB) return json({ ok: false, error: "DB binding missing (env.DB)" }, { status: 500 });

    // Body lesen
    const body = await readJson(context.request);
    const setupKey = String(body.setupKey ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!setupKey || !username || !password) {
      return bad(400, "setupKey, username, password required");
    }

    if (!env.SETUP_KEY) return json({ ok: false, error: "SETUP_KEY missing" }, { status: 500 });
    if (setupKey !== env.SETUP_KEY) return bad(403, "invalid setup key");

    // Spalten erkennen (damit es zu deiner DB passt)
    const colSet = await getUserTableColumns(DB);

    const adminCol =
      pickCol(colSet, ["is_admin", "isAdmin", "admin"]) || "is_admin";

    const saltCol =
      pickCol(colSet, ["password_salt_b64", "password_salt", "salt_b64", "salt"]) ||
      "password_salt_b64";

    const hashCol =
      pickCol(colSet, ["password_hash_b64", "password_hash", "hash_b64", "hash"]) ||
      "password_hash_b64";

    // Wenn schon ein Admin existiert -> Setup sperren
    const adminExists = await DB.prepare(
      `SELECT 1 FROM users WHERE ${adminCol} = 1 LIMIT 1`
    ).first();

    if (adminExists) {
      // Wichtig: IMMER JSON zurückgeben (kein "Invalid response" mehr)
      return json({ ok: false, error: "setup_disabled" }, { status: 409 });
    }

    // Username schon vergeben?
    const already = await DB.prepare(
      `SELECT 1 FROM users WHERE username = ? LIMIT 1`
    ).bind(username).first();

    if (already) return bad(409, "username already exists");

    // Passwort Hash erstellen (mit optionalem Pepper aus deinen CF Vars)
    const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER);

    // Admin anlegen
    const ins = await DB.prepare(
      `INSERT INTO users (username, ${saltCol}, ${hashCol}, ${adminCol})
       VALUES (?1, ?2, ?3, 1)`
    ).bind(username, rec.salt_b64, rec.hash_b64).run();

    const userId = ins?.meta?.last_row_id;
    if (!userId) return json({ ok: false, error: "failed to create admin" }, { status: 500 });

    // Session erstellen + Cookie setzen (automatisches Einloggen)
    const sid = await createSession(env, userId);

    return json(
      { ok: true, user: { id: userId, username, is_admin: true } },
      { headers: { "set-cookie": setSessionCookie(sid) } }
    );
  } catch (err) {
    // Ganz wichtig: Fehler immer als JSON zurückgeben
    return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
