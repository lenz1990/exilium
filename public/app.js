function $(id) { return document.getElementById(id); }

const els = {
  logoutBtn: $("logoutBtn"),
  welcomeText: $("welcomeText"),
  globalMsg: $("globalMsg"),

  adminPanel: $("adminPanel"),

  createUserForm: $("createUserForm"),
  newUsername: $("newUsername"),
  newPassword: $("newPassword"),
  newIsAdmin: $("newIsAdmin"),
  createMsg: $("createMsg"),

  refreshUsersBtn: $("refreshUsersBtn"),
  usersTbody: $("usersTbody"),
  usersMsg: $("usersMsg"),

  resetDialog: $("resetDialog"),
  resetForm: $("resetForm"),
  resetUserLabel: $("resetUserLabel"),
  resetPassword: $("resetPassword"),
  resetInvalidate: $("resetInvalidate"),
  resetCancelBtn: $("resetCancelBtn"),
  resetMsg: $("resetMsg"),
};

function showMsg(el, text, type = "error") {
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.remove("ok", "error");
  el.classList.add(type === "ok" ? "ok" : "error");
  el.textContent = text;
}

function hideMsg(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
  el.classList.remove("ok", "error");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

async function api(path, opts = {}) {
  const init = {
    credentials: "include",
    headers: { "content-type": "application/json; charset=utf-8", ...(opts.headers || {}) },
    ...opts,
  };
  if (init.body && typeof init.body !== "string") init.body = JSON.stringify(init.body);
  const res = await fetch(path, init);
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  return { res, data };
}

async function loadMe() {
  const { res, data } = await api("/api/me", { method: "GET", headers: {} });
  if (!res.ok || !data?.ok || !data?.user) {
    location.href = "/login";
    return null;
  }
  return data.user;
}

async function logout() {
  await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
  location.href = "/login";
}

async function loadUsers() {
  hideMsg(els.usersMsg);
  els.usersTbody.innerHTML = "";

  const { res, data } = await api("/api/users/list", { method: "GET", headers: {} });
  if (!res.ok || !data?.ok) {
    showMsg(els.usersMsg, data?.error || `User-Liste konnte nicht geladen werden (${res.status})`);
    return [];
  }

  const users = data.users || [];
  renderUsers(users);
  return users;
}

let currentUser = null;
let selectedResetUser = null;

function renderUsers(users) {
  els.usersTbody.innerHTML = users.map((u) => {
    const isAdmin = u.is_admin ? "ja" : "nein";
    const safeName = escapeHtml(u.username);
    const disableDelete = (currentUser && Number(u.id) === Number(currentUser.id)) || Number(u.id) === 1;

    return `
      <tr>
        <td>${u.id}</td>
        <td>${safeName}</td>
        <td>${isAdmin}</td>
        <td>
          <button class="btn secondary" data-action="reset" data-id="${u.id}" data-username="${safeName}">
            PW Reset
          </button>
          <button class="btn danger" data-action="delete" data-id="${u.id}" ${disableDelete ? "disabled" : ""}>
            Löschen
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Delegation
  els.usersTbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const id = Number(btn.getAttribute("data-id"));
      const username = btn.getAttribute("data-username");

      if (action === "delete") {
        await deleteUser(id);
      } else if (action === "reset") {
        openResetDialog({ id, username });
      }
    });
  });
}

async function createUser(username, password, isAdmin) {
  hideMsg(els.createMsg);

  const { res, data } = await api("/api/users/create", {
    method: "POST",
    body: { username, password, is_admin: !!isAdmin },
  });

  if (!res.ok || !data?.ok) {
    showMsg(els.createMsg, data?.error || `User konnte nicht erstellt werden (${res.status})`);
    return false;
  }

  showMsg(els.createMsg, `User "${data.user?.username || username}" erstellt.`, "ok");
  els.newUsername.value = "";
  els.newPassword.value = "";
  els.newIsAdmin.checked = false;

  await loadUsers();
  return true;
}

async function deleteUser(id) {
  hideMsg(els.usersMsg);

  const sure = confirm(`User ID ${id} wirklich löschen?`);
  if (!sure) return;

  const { res, data } = await api("/api/users/delete", {
    method: "POST",
    body: { id },
  });

  if (!res.ok || !data?.ok) {
    showMsg(els.usersMsg, data?.error || `Löschen fehlgeschlagen (${res.status})`);
    return;
  }

  showMsg(els.usersMsg, `User gelöscht.`, "ok");
  await loadUsers();
}

/* ===== Passwort Reset ===== */

function openResetDialog(u) {
  selectedResetUser = u;
  hideMsg(els.resetMsg);
  els.resetPassword.value = "";
  els.resetInvalidate.checked = true;

  els.resetUserLabel.textContent = `User: ${u.username} (ID ${u.id})`;

  if (typeof els.resetDialog.showModal === "function") {
    els.resetDialog.showModal();
  } else {
    // fallback: falls dialog nicht unterstützt (sollte bei dir aber gehen)
    alert("Dein Browser unterstützt <dialog> nicht.");
  }
}

function closeResetDialog() {
  selectedResetUser = null;
  hideMsg(els.resetMsg);
  if (els.resetDialog.open) els.resetDialog.close();
}

async function resetPasswordForUser(id, newPassword, invalidateSessions) {
  hideMsg(els.resetMsg);

  const { res, data } = await api("/api/users/reset", {
    method: "POST",
    body: {
      id,
      new_password: newPassword,
      invalidate_sessions: !!invalidateSessions,
    },
  });

  if (!res.ok || !data?.ok) {
    showMsg(els.resetMsg, data?.error || `Reset fehlgeschlagen (${res.status})`);
    return false;
  }

  showMsg(
    els.resetMsg,
    `Passwort gesetzt${data.sessions_invalidated ? " + Sessions gelöscht" : ""}.`,
    "ok"
  );

  // Liste updaten (nicht zwingend, aber sinnvoll)
  await loadUsers();

  // kurz anzeigen, dann schließen
  setTimeout(closeResetDialog, 600);
  return true;
}

/* ===== init ===== */

async function init() {
  currentUser = await loadMe();
  if (!currentUser) return;

  els.welcomeText.textContent = `Eingeloggt als ${currentUser.username}${currentUser.is_admin ? " (Admin)" : ""}`;

  // logout
  els.logoutBtn.addEventListener("click", logout);

  // admin panel anzeigen?
  if (currentUser.is_admin) {
    els.adminPanel.classList.remove("hidden");

    // create user
    els.createUserForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = els.newUsername.value.trim();
      const p = els.newPassword.value.trim();
      const a = els.newIsAdmin.checked;

      if (!u || !p) {
        showMsg(els.createMsg, "Username und Passwort sind Pflichtfelder.");
        return;
      }
      if (p.length < 10) {
        showMsg(els.createMsg, "Passwort muss mindestens 10 Zeichen haben.");
        return;
      }

      await createUser(u, p, a);
    });

    // refresh list
    els.refreshUsersBtn.addEventListener("click", loadUsers);

    // reset dialog buttons
    els.resetCancelBtn.addEventListener("click", closeResetDialog);
    els.resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedResetUser) return;

      const p = els.resetPassword.value.trim();
      if (!p || p.length < 10) {
        showMsg(els.resetMsg, "Passwort muss mindestens 10 Zeichen haben.");
        return;
      }

      await resetPasswordForUser(selectedResetUser.id, p, els.resetInvalidate.checked);
    });

    await loadUsers();
  }
}

init().catch((err) => {
  console.error(err);
  showMsg(els.globalMsg, "Unerwarteter Fehler im Dashboard. Siehe Console.");
});
