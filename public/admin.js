async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { ok: false, error: text }; }
  return { res, data };
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg || "";
  el.className = isError ? "error" : "hint";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

async function requireAdminOrRedirect() {
  const { res, data } = await api("/api/me");
  if (!res.ok || !data?.user) {
    location.href = "/login";
    return null;
  }
  if (!data.user.is_admin) {
    location.href = "/app";
    return null;
  }
  return data.user;
}

async function loadUsers() {
  const { res, data } = await api("/api/users/list");
  if (!res.ok || !data.ok) {
    setStatus(data.error || `Fehler beim Laden (${res.status})`, true);
    return [];
  }
  return data.users || [];
}

function render(users, me) {
  // Dropdown fürs PW-Reset
  const pwSel = document.getElementById("pwUser");
  pwSel.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.username)} (#${u.id})</option>`).join("");

  // Tabelle
  const tbody = document.querySelector("#usersTable tbody");
  tbody.innerHTML = users.map(u => {
    const adminChecked = u.is_admin ? "checked" : "";
    const disableDelete = (u.id === me.id) ? "disabled" : "";
    return `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>
          <input type="checkbox" data-act="toggleAdmin" data-id="${u.id}" ${adminChecked} ${u.id === me.id ? "disabled" : ""}/>
        </td>
        <td>
          <button class="btn danger" data-act="delete" data-id="${u.id}" ${disableDelete}>Löschen</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-act='toggleAdmin']").forEach(cb => {
    cb.addEventListener("change", async (e) => {
      const id = Number(e.target.dataset.id);
      const is_admin = !!e.target.checked;
      const { res, data } = await api("/api/users/set-admin", {
        method: "POST",
        body: JSON.stringify({ user_id: id, is_admin }),
      });
      if (!res.ok || !data.ok) {
        setStatus(data.error || `Fehler (${res.status})`, true);
        e.target.checked = !is_admin; // rollback
      } else {
        setStatus("Admin-Status aktualisiert.");
      }
    });
  });

  tbody.querySelectorAll("[data-act='delete']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);
      if (!confirm(`User #${id} wirklich löschen?`)) return;
      const { res, data } = await api("/api/users/delete", {
        method: "POST",
        body: JSON.stringify({ user_id: id }),
      });
      if (!res.ok || !data.ok) {
        setStatus(data.error || `Fehler (${res.status})`, true);
      } else {
        setStatus("User gelöscht.");
        boot(); // reload
      }
    });
  });
}

async function boot() {
  setStatus("");
  const me = await requireAdminOrRedirect();
  if (!me) return;

  const users = await loadUsers();
  render(users, me);
}

document.getElementById("createBtn").addEventListener("click", async () => {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value.trim();
  const is_admin = document.getElementById("newIsAdmin").checked;

  const { res, data } = await api("/api/users/create", {
    method: "POST",
    body: JSON.stringify({ username, password, is_admin }),
  });

  if (!res.ok || !data.ok) {
    setStatus(data.error || `Fehler (${res.status})`, true);
    return;
  }

  document.getElementById("newUsername").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("newIsAdmin").checked = false;
  setStatus("User erstellt.");
  boot();
});

document.getElementById("pwBtn").addEventListener("click", async () => {
  const user_id = Number(document.getElementById("pwUser").value);
  const password = document.getElementById("pwNew").value.trim();

  const { res, data } = await api("/api/users/set-password", {
    method: "POST",
    body: JSON.stringify({ user_id, password }),
  });

  if (!res.ok || !data.ok) {
    setStatus(data.error || `Fehler (${res.status})`, true);
    return;
  }

  document.getElementById("pwNew").value = "";
  setStatus("Passwort gesetzt (Sessions wurden abgemeldet).");
});

document.getElementById("reloadBtn").addEventListener("click", boot);

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.href = "/login";
});

boot();
