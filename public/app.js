function el(id) {
  return document.getElementById(id);
}

function showMsg(box, text, ok) {
  if (!box) return;
  box.style.display = text ? "block" : "none";
  box.textContent = text || "";
  box.className = "msg " + (ok ? "ok" : "err");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { res, data };
}

document.addEventListener("DOMContentLoaded", async () => {
  const who = el("who");
  const logoutBtn = el("logout");

  const adminBox = el("adminBox");
  const adminMsg = el("adminMsg");
  const createUserForm = el("createUserForm");
  const refreshUsersBtn = el("refreshUsersBtn");
  const usersTbody = el("usersTbody");

  // Falls irgendwas fehlt → nicht crashen
  if (!who || !logoutBtn) {
    console.error("app.html fehlt required IDs (who/logout). Bitte app.html exakt so übernehmen.");
    return;
  }

  // 1) Session check
  const me = await api("/api/me");
  if (!me.res.ok || !me.data || !me.data.user) {
    location.href = "/login";
    return;
  }

  const user = me.data.user;
  who.textContent = `Eingeloggt als ${user.username}${user.is_admin ? " (Admin)" : ""}`;

  // 2) Logout
  logoutBtn.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    location.href = "/login";
  });

  // 3) Admin UI aktivieren
  if (user.is_admin && adminBox) {
    adminBox.style.display = "block";

    async function loadUsers() {
      if (!usersTbody) return;
      usersTbody.innerHTML = "";

      const r = await api("/api/users/list", { method: "GET" });
      if (!r.res.ok || !r.data?.ok) {
        showMsg(adminMsg, r.data?.error || `Fehler (${r.res.status}) beim Laden der User`, false);
        return;
      }

      const users = r.data.users || [];
      for (const u of users) {
        const tr = document.createElement("tr");

        const tdId = document.createElement("td");
        tdId.textContent = String(u.id);

        const tdName = document.createElement("td");
        tdName.textContent = u.username;

        const tdAdmin = document.createElement("td");
        tdAdmin.textContent = u.is_admin ? "ja" : "nein";

        const tdAct = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.className = "btn small danger";
        delBtn.textContent = "Löschen";
        delBtn.disabled = (u.id === user.id || u.id === 1);
        delBtn.addEventListener("click", async () => {
          if (!confirm(`User "${u.username}" wirklich löschen?`)) return;

          const del = await api("/api/users/delete", {
            method: "POST",
            body: JSON.stringify({ id: u.id }),
          });

          if (!del.res.ok || !del.data?.ok) {
            showMsg(adminMsg, del.data?.error || `Löschen fehlgeschlagen (${del.res.status})`, false);
            return;
          }

          showMsg(adminMsg, "User gelöscht.", true);
          await loadUsers();
        });

        tdAct.appendChild(delBtn);

        tr.appendChild(tdId);
        tr.appendChild(tdName);
        tr.appendChild(tdAdmin);
        tr.appendChild(tdAct);
        usersTbody.appendChild(tr);
      }
    }

    // Button: Refresh
    if (refreshUsersBtn) {
      refreshUsersBtn.addEventListener("click", loadUsers);
    }

    // Create User
    if (createUserForm) {
      createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        showMsg(adminMsg, "", true);

        const username = (el("newUser")?.value || "").trim();
        const password = (el("newPass")?.value || "");
        const is_admin = !!el("newIsAdmin")?.checked;

        if (!username || !password) {
          showMsg(adminMsg, "Bitte Username + Passwort eingeben.", false);
          return;
        }
        if (password.length < 10) {
          showMsg(adminMsg, "Passwort muss mindestens 10 Zeichen haben.", false);
          return;
        }

        const created = await api("/api/users/create", {
          method: "POST",
          body: JSON.stringify({ username, password, is_admin }),
        });

        if (!created.res.ok || !created.data?.ok) {
          showMsg(adminMsg, created.data?.error || `User erstellen fehlgeschlagen (${created.res.status})`, false);
          return;
        }

        showMsg(adminMsg, "User erstellt.", true);
        createUserForm.reset();
        await loadUsers();
      });
    }

    // initial load
    await loadUsers();
  }
});
