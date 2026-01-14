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
  // Wenn schon eingeloggt -> direkt ins Dashboard
  const { data } = await api("/api/me");
  if (data?.user) location.href = "/app";
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  show("");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    show("Bitte Username und Passwort eingeben.");
    return;
  }

  const { res, data } = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok || !data?.ok) {
    show(data?.error || `Login fehlgeschlagen (${res.status})`);
    return;
  }

  show("Login ok – weiterleiten…", true);
  location.href = "/app";
});
