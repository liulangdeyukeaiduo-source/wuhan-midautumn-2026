const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function ensureSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

async function getRow(db, key) {
  return await db.prepare("SELECT value, updated_at FROM app_kv WHERE key = ?").bind(key).first();
}

async function putRow(db, key, value) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO app_kv (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(key, value, now).run();
  return now;
}

async function verifyPin(db, request) {
  const auth = await getRow(db, "auth_hash");
  if (!auth) return { ok: false, status: 428, reason: "needs_setup" };
  const pin = request.headers.get("X-Trip-Pin") || "";
  if (!pin) return { ok: false, status: 401, reason: "pin_required" };
  const incoming = await sha256Hex(pin);
  if (incoming !== auth.value) return { ok: false, status: 401, reason: "invalid_pin" };
  return { ok: true };
}

function cleanItem(item) {
  return {
    id: String(item?.id || "").slice(0, 80),
    title: String(item?.title || "").slice(0, 120),
    detail: String(item?.detail || "").slice(0, 300),
    deadline: String(item?.deadline || "").slice(0, 80)
  };
}

function cleanState(input) {
  const state = input && typeof input === "object" ? input : {};
  const routeState = state.routeState && typeof state.routeState === "object" ? state.routeState : {};
  const prep = state.prepState && typeof state.prepState === "object" ? state.prepState : {};
  const done = prep.done && typeof prep.done === "object" ? prep.done : {};

  const prepState = { done };
  if (Array.isArray(prep.items)) {
    prepState.items = prep.items.slice(0, 120).map(cleanItem).filter(item => item.id && item.title);
  } else {
    prepState.custom = Array.isArray(prep.custom)
      ? prep.custom.slice(0, 100).map(cleanItem).filter(item => item.id && item.title)
      : [];
  }

  return { routeState, prepState };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return reply({ error: "not_configured", message: "D1 binding DB is missing." }, 503);

  await ensureSchema(env.DB);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // Public metadata only: lets old/new browsers know whether they should show setup or login.
  if (method === "GET" && url.searchParams.get("probe") === "1") {
    const auth = await getRow(env.DB, "auth_hash");
    return reply({ ok: true, configured: true, initialized: !!auth });
  }

  if (method === "POST") {
    let body = {};
    try { body = await request.json(); } catch { return reply({ error: "invalid_json" }, 400); }
    if (body.action !== "setup") return reply({ error: "unsupported_action" }, 400);

    const pin = String(body.pin || "").trim();
    if (!/^\d{4,12}$/.test(pin)) return reply({ error: "invalid_pin", message: "PIN must be 4-12 digits." }, 400);

    const existing = await getRow(env.DB, "auth_hash");
    if (existing) return reply({ error: "already_initialized" }, 409);

    const hash = await sha256Hex(pin);
    const initializedAt = await putRow(env.DB, "auth_hash", hash);
    const state = cleanState(body.state);
    const updatedAt = await putRow(env.DB, "trip_state", JSON.stringify(state));
    return reply({ ok: true, state, updatedAt, initializedAt });
  }

  const auth = await verifyPin(env.DB, request);
  if (!auth.ok) return reply({ error: auth.reason }, auth.status);

  if (method === "GET") {
    const row = await getRow(env.DB, "trip_state");
    const state = row ? JSON.parse(row.value) : { routeState: {}, prepState: { done: {}, items: [] } };
    return reply({ ok: true, state, updatedAt: row?.updated_at || "" });
  }

  if (method === "PUT") {
    let body = {};
    try { body = await request.json(); } catch { return reply({ error: "invalid_json" }, 400); }
    const state = cleanState(body.state);
    const updatedAt = await putRow(env.DB, "trip_state", JSON.stringify(state));
    return reply({ ok: true, state, updatedAt });
  }

  return reply({ error: "method_not_allowed" }, 405);
}
