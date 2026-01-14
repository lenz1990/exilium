import { json, readJson, hashPassword, createSessionAndSetCookie } from "../_shared.js";

export async function onRequestPost(context) {
  try {
    const env = context.env;
    const DB = env.DB;

    if (!DB) return json({ ok: false, error: "DB binding missing (env.DB)" }, 500);
    if (!env.SETUP_KEY) return json({ ok: false, error: "SETUP_KEY missing" }, 500);

    const body = await readJson(context.request);
    const setupKey = (body.setupKey ?? "").trim();
    const username = (body.username ?? "").trim();
    const password = (body.password ?? "").trim();

    if (!setupKey || !username || !password) {
      return json({ ok: false, error: "setupKey, username, password required" }, 400);
    }

    if (setupKey !== env.SETUP_KEY) {
      return json({ ok: false, error: "invalid setup key" }, 403);
    }

    // Wenn schon ein Admin existiert -> Setup endgültig sperren
    const adminExists = await DB.prepare(
      "SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1"
    ).first();

    if (adminExists) {
      return json({ ok: false, error: "setup_disabled" }, 409);
    }

    const password_hash = await hashPassword(env, password);

    // Admin erstellen
    const res = await DB.prepare(
      "INSERT INTO users (username, password_hash, is_admin) VALUES (?1, ?2, 1)"
    ).bind(username, password_hash).run();

    const userId = res.meta?.last_row_id;
    if (!userId) return json({ ok: false, error: "failed to create admin" }, 500);

    // Direkt einloggen (Session-Cookie setzen)
    return await createSessionAndSetCookie(context, {
      id: userId,
      username,
      is_admin: 1,
    });

  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}
