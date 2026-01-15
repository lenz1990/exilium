import { json, bad, readJson, requireUser, makePasswordRecord } from "../../_shared.js";

async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (!user.is_admin) return { user: null, response: bad(403, "Admin only") };
  return { user, response: null };
}

function normUsername(raw) {
  return String(raw || "").trim();
}

export async function onRequestPost(context) {
  const gate = await requireAdmin(context);
  if (gate.response) return gate.response;

  const body = await readJson(context.request);
  const username = normUsername(body.username);
  const password = String(body.password || "");
  const is_admin = !!body.is_admin;

  if (!username) return bad(400, "username required");
  if (username.length < 3 || username.length > 32) return bad(400, "username must be 3-32 chars");
  if (/\s/.test(username)) return bad(400, "username must not contain spaces");

  if (!password) return bad(400, "password required");
  if (password.length < 10) return bad(400, "password must be at least 10 chars");

  const existing = await context.env.DB
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) return bad(409, "username already exists");

  const rec = await makePasswordRecord(password, context.env.PASSWORD_PEPPER || "");

  const ins = await context.env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)"
  )
    .bind(username, rec.hash_b64, rec.salt_b64, is_admin ? 1 : 0)
    .run();

  const newId = ins?.meta?.last_row_id ?? null;

  return json({ ok: true, id: newId, username, is_admin });
}
