const msg = document.getElementById("msg");
const form = document.getElementById("form");

function show(text, ok = false) {
  msg.textContent = text || "";
  msg.className = "msg " + (ok ? "ok" : "err");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { res, data };
}

(async () => {
  const { data } = await api("/api/setup", { method: "GET" });
  if (data && data.ok && data.needs_setup === false) {
    show("Setup ist bereits erledigt. Geh zu /login.", true);
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  show("");

  const setupKey = document.getElementById("setupKey").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!setupKey || !username || !password) return show("Alles ausfüllen.");
  if (password.length < 10) return show("Passwort min. 10 Zeichen.");

  const { res, data } = await api("/api/setup", {
    method: "POST",
    body: JSON.stringify({ setupKey, username, password }),
  });

  if (!res.ok || !data?.ok) {
    show(data?.error || `Fehler (${res.status})`);
    return;
  }

  show("Admin erstellt ✅ Weiter zu Login…", true);
  location.href = "/login";
});
