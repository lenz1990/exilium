import {
  json,
  bad,
  readJson,
  makePasswordRecord,
  requireUser,
} from "../../_shared.js";

// Hilfsfunktion: D1 PRAGMA lesen
async function getUsersTableInfo(env) {
  const res = await env.DB.prepare("PRAGMA table_info(users)").all();
  return res?.results || [];
}

function pickCol(cols, ...candidates) {
  const set = new Set(cols.map((c) => c.name));
  for (const c of candidates) if (set.has(c)) return c;
  return null;
}

export async function onRequestGet(context) {
  const { env } = context;

  // nur eingeloggt
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  // nur Admin
  if (!auth.user.is_admin) return bad(403, "Admin only");

  const rows = await env.DB.prepare(
    "SELECT id, username, is_admin FROM users ORDER BY id ASC"
  ).all();

  return json({ ok: true, users: rows.results || [] });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  // nur eingeloggt
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  // nur Admin
  if (!auth.user.is_admin) return bad(403, "Admin only");

  try {
    const body = await readJson(request);

    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    // Checkbox kann bei dir is_admin ODER isAdmin heißen – wir akzeptieren beides
    const isAdmin =
      body.is_admin === true ||
      body.is_admin === 1 ||
      body.isAdmin === true ||
      body.isAdmin === 1;

    if (!username || !password) return bad(400, "username and password required");
    if (password.length < 10) return bad(400, "password must be at least 10 characters");

    // Tabelle checken und Spalten passend wählen (damit kein 500 wegen NOT NULL/Spaltennamen kommt)
    const cols = await getUsersTableInfo(env);

    const COL_USERNAME = pickCol(cols, "username");
    const COL_HASH = pickCol(cols, "password_hash", "hash_b64", "hash");
    const COL_SALT = pickCol(cols, "salt", "salt_b64");
    const COL_IS_ADMIN = pickCol(cols, "is_admin", "isAdmin");
    const COL_CREATED_AT = pickCol(cols, "created_at", "createdAt");
    const COL_UPDATED_AT = pickCol(cols, "updated_at", "updatedAt");

    if (!COL_USERNAME || !COL_HASH || !COL_SALT) {
      return bad(
        500,
        `users table columns not compatible (need username + password_hash/hash + salt). Found: ${cols
          .map((c) => c.name)
          .join(", ")}`
      );
    }

    // Passwort-Record erzeugen
    const rec = await makePasswordRecord(password, env.PASSWORD_PEPPER || "");

    const fields = [COL_USERNAME, COL_HASH, COL_SALT];
    const values = [username, rec.hash_b64, rec.salt_b64];

    if (COL_IS_ADMIN) {
      fields.push(COL_IS_ADMIN);
      values.push(isAdmin ? 1 : 0);
    }

    // falls DB created_at/updated_at hat
    const now = Math.floor(Date.now() / 1000);
    if (COL_CREATED_AT) {
      fields.push(COL_CREATED_AT);
      values.push(now);
    }
    if (COL_UPDATED_AT) {
      fields.push(COL_UPDATED_AT);
      values.push(now);
    }

    const placeholders = fields.map(() => "?").join(", ");
    const sql = `INSERT INTO users (${fields.join(", ")}) VALUES (${placeholders})`;

    await env.DB.prepare(sql).bind(...values).run();

    // Neu laden und zurückgeben
    const row = await env.DB.prepare(
      "SELECT id, username, is_admin FROM users WHERE username = ?"
    )
      .bind(username)
      .first();

    return json({ ok: true, user: row });
  } catch (e) {
    const msg = String(e?.message || e);

    // Unique-Username sauber als 409 zurückgeben statt 500
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return bad(409, "username already exists");
    }

    return bad(500, `create user failed: ${msg}`);
  }
}
