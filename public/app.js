async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts.headers || {}) }
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  return { res, data };
}

async function boot() {
  const { data } = await api("/api/me", { method: "GET" });
  if (!data || !data.ok || !data.user) {
    location.href = "/login";
    return;
  }

  document.getElementById("who").textContent =
    `Eingeloggt als ${data.user.username}${data.user.is_admin ? " (Admin)" : ""}`;

  if (data.user.is_admin) {
    document.getElementById("adminBox").style.display = "block";
  }
}

document.getElementById("logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  location.href = "/login";
});

document.getElementById("createUser").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  msg.textContent = "";

  const username = document.getElementById("nu").value.trim();
  const password = document.getElementById("np").value.trim();

  const { res, data } = await api("/api/users/create", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  if (res.ok && data.ok) {
    msg.textContent = `User erstellt: ${data.username}`;
    msg.className = "msg ok";
  } else {
    msg.textContent = (data && data.error) ? data.error : "Fehler";
    msg.className = "msg err";
  }
});

boot();
