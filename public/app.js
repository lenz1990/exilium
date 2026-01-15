(function () {
  const $ = (id) => document.getElementById(id);

  const logoutBtn = $("logoutBtn");
  const welcomeLine = $("welcomeLine");
  const appMsg = $("appMsg");

  const adminPanel = $("adminPanel");
  const createUserForm = $("createUserForm");
  const newUsername = $("newUsername");
  const newPassword = $("newPassword");
  const newIsAdmin = $("newIsAdmin");
  const refreshUsersBtn = $("refreshUsersBtn");
  const usersTbody = $("usersTbody");
  const adminMsg = $("adminMsg");
  const adminHint = $("adminHint");

  function showMsg(el, text, ok = false) {
    if (!el) return;
    el.style.display = "block";
    el.className = "msg " + (ok ? "msg-ok" : "msg-bad");
    el.textContent = text;
  }
  function clearMsg(el) {
    if (!el) return;
    el.style.display = "none";
    el.textContent = "";
  }

  async function api(path, init = {}) {
    const res = await fetch(path, {
      credentials: "include",
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init.headers || {}),
      },
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {}

    return { res, data };
  }

  function renderUsers(users, myId) {
    if (!usersTbody) return;
    usersTbody.innerHTML = "";

    for (const u of users) {
      const tr = document.createElement("tr");

      const tdId = document.createElement("td");
      tdId.textContent = String(u.id);

      const tdName = document.createElement("td");
      tdName.textContent = u.username;

      const tdAdmin = document.createElement("td");
      tdAdmin.textContent = u.is_admin ? "ja" : "nein";

      const tdAction = document.createElement("td");

      const btn = document.createElement("button");
      btn.className = "btn btn-ghost";
      btn.textContent = "Löschen";

      // Eigener Admin-User (id 1) schützen – falls du das so willst
      const protectedSelf = (u.id === myId);
      const protectedId1 = (u.id === 1);

      if (protectedSelf || protectedId1) {
        btn.disabled = true;
        btn.title = "Dieser Account ist geschützt";
      } else {
        btn.addEventListener("click", async () => {
          clearMsg(adminMsg);

          const { res, data } = await api("/api/users/delete", {
            method: "POST",
            body: JSON.stringify({ id: u.id }),
          });

          if (!res.ok || !data?.ok) {
            showMsg(adminMsg, `Löschen fehlgeschlagen (${res.status}): ${data?.error || "Unknown error"}`, false);
            return;
          }

          showMsg(adminMsg, `User "${u.username}" gelöscht.`, true);
          await loadUsers(myId);
        });
      }

      tdAction.appendChild(btn);

      tr.appendChild(tdId);
      tr.appendChild(tdName);
      tr.appendChild(tdAdmin);
      tr.appendChild(tdAction);

      usersTbody.appendChild(tr);
    }
  }

  async function loadUsers(myId) {
    clearMsg(adminMsg);
    if (adminHint) adminHint.textContent = "";

    const { res, data } = await api("/api/users/list", { method: "GET" });

    if (!res.ok || !data?.ok) {
      showMsg(adminMsg, `User-Liste laden fehlgeschlagen (${res.status}): ${data?.error || "Unknown error"}`, false);
      return;
    }

    const users = Array.isArray(data.users) ? data.users : [];
    renderUsers(users, myId);

    if (adminHint) {
      adminHint.textContent = "Hinweis: Du kannst deinen eigenen Account nicht löschen (und ID 1 ist geschützt).";
    }
  }

  async function boot() {
    clearMsg(appMsg);
    clearMsg(adminMsg);

    // 1) Session prüfen
    const { res, data } = await api("/api/me", { method: "GET" });

    if (!res.ok || !data?.ok || !data.user) {
      // nicht eingeloggt -> login
      window.location.href = "/login";
      return;
    }

    const me = data.user;
    if (welcomeLine) {
      welcomeLine.textContent = `Eingeloggt als ${me.username}${me.is_admin ? " (Admin)" : ""}`;
    }

    // 2) Logout
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await api("/api/logout", { method: "POST" });
        window.location.href = "/login";
      });
    }

    // 3) Admin Panel
    if (me.is_admin && adminPanel) {
      adminPanel.style.display = "block";

      if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener("click", async () => {
          await loadUsers(me.id);
        });
      }

      if (createUserForm) {
        createUserForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          clearMsg(adminMsg);

          const username = (newUsername?.value || "").trim();
          const password = (newPassword?.value || "").trim();
          const is_admin = !!newIsAdmin?.checked;

          if (!username || !password) {
            showMsg(adminMsg, "Username und Passwort sind Pflicht.", false);
            return;
          }
          if (password.length < 10) {
            showMsg(adminMsg, "Passwort muss mindestens 10 Zeichen haben.", false);
            return;
          }

          const { res, data } = await api("/api/users/create", {
            method: "POST",
            body: JSON.stringify({ username, password, is_admin }),
          });

          if (!res.ok || !data?.ok) {
            showMsg(adminMsg, `User erstellen fehlgeschlagen (${res.status}): ${data?.error || "Unknown error"}`, false);
            return;
          }

          showMsg(adminMsg, `User "${username}" erstellt.`, true);

          if (newUsername) newUsername.value = "";
          if (newPassword) newPassword.value = "";
          if (newIsAdmin) newIsAdmin.checked = false;

          await loadUsers(me.id);
        });
      }

      await loadUsers(me.id);
    } else {
      // kein Admin -> admin panel bleibt aus
      if (adminPanel) adminPanel.style.display = "none";
      showMsg(appMsg, "Du bist eingeloggt, aber kein Admin.", true);
    }
  }

  // START
  boot().catch((err) => {
    console.error(err);
    showMsg(appMsg, "Frontend-Fehler: " + (err?.message || String(err)), false);
  });
})();
