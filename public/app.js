async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json; charset=utf-8", ...(opts.headers || {}) },
    ...opts,
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    const txt = await res.text().catch(() => "");
    data = { ok: res.ok, raw: txt };
  }

  return { res, data };
}

function setMsg(el, text, ok = false) {
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.classList.remove("ok", "err");
  el.classList.add(ok ? "ok" : "err");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function loadMe() {
  const { res, data } = await api("/api/me", { method: "GET" });
  if (!res.ok || !data?.ok) return null;
  return data.user || null;
}

async function loadUsers() {
  const tbody = document.getElementById("usersTbody");
  const msg = document.getElementById("usersMsg");
  setMsg(msg, "");

  tbody.innerHTML = `<tr><td colspan="4" class="muted">Lade…</td></tr>`;

  const { res, data } = await api("/api/users", { method: "GET" });
  if (!res.ok || !data?.ok) {
    const err = data?.error || `Fehler (${res.status})`;
    tbody.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(err)}</td></tr>`;
    setMsg(msg, `User-Liste konnte nicht geladen werden: ${err}`, false);
    return;
  }

  const users = data.users || [];
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Keine User gefunden.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isAdmin = u.is_admin ? "ja" : "nein";
    return `
      <tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(isAdmin)}</td>
        <td>
          <button class="btn btn-danger btn-sm" data-del="${escapeHtml(u.id)}">Löschen</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm(`User #${id} wirklich löschen?`)) return;

      const { res, data } = await api(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok || !data?.ok) {
        const err = data?.error || `Fehler (${res.status})`;
        setMsg(msg, `Löschen fehlgeschlagen: ${err}`, false);
        return;
      }

      setMsg(msg, `User #${id} gelöscht.`, true);
      await loadUsers();
    });
  });
}

async function main() {
  const logoutBtn = document.getElementById("logoutBtn");
  const welcomeText = document.getElementById("welcomeText");
  const adminCard = document.getElementById("adminCard");
  const refreshUsersBtn = document.getElementById("refreshUsersBtn");

  // Login-Status prüfen
  const me = await loadMe();
  if (!me) {
    // nicht eingeloggt -> Login
    window.location.href = "/login";
    return;
  }

  welcomeText.textContent = `Eingeloggt als ${me.username}${me.is_admin ? " (Admin)" : ""}`;

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    window.location.href = "/login";
  });

  // Admin-UI
  if (me.is_admin) {
    adminCard.style.display = "block";

    // Create user
    const form = document.getElementById("createUserForm");
    const createMsg = document.getElementById("createMsg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(createMsg, "");

      const username = document.getElementById("newUsername").value.trim();
      const password = document.getElementById("newPassword").value.trim();
      const is_admin = document.getElementById("newIsAdmin").checked;

      const { res, data } = await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password, is_admin }),
      });

      if (!res.ok || !data?.ok) {
        const err = data?.error || `Fehler (${res.status})`;
        setMsg(createMsg, `User konnte nicht erstellt werden: ${err}`, false);
        return;
      }

      setMsg(createMsg, `User erstellt: ${data.user?.username} (#${data.user?.id})`, true);
      document.getElementById("newPassword").value = "";
      await loadUsers();
    });

    refreshUsersBtn.addEventListener("click", loadUsers);

    // initial laden
    await loadUsers();
  }
}

main().catch((err) => {
  console.error(err);
  alert("Unerwarteter Fehler – siehe Console.");
});
