const who = document.getElementById("who");
const logoutBtn = document.getElementById("logout");

const adminBox = document.getElementById("adminBox");
const adminMsg = document.getElementById("adminMsg");
const createUserForm = document.getElementById("createUserForm");

function showAdmin(text, ok = false) {
  adminMsg.textContent = text || "";
  adminMsg.className = "msg " + (ok ? "ok" : "err");
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
  const { res, data } = await api("/api/me");
  if (!res.ok || !data?.user) {
    location.href = "/login";
    return;
  }

  who.textContent = `Eingeloggt als ${data.user.username}${data.user.is_admin ? " (Admin)" : ""}`;

  if (data.user.is_admin) {
    adminBox.style.display = "block";
  }
})();

logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  location.href = "/login";
});

createUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAdmin("");

  const username = document.getElementById("newUser").value.trim();
  const password = document.getElementById("newPass").value;

  if (!username || !password) return showAdmin("Bitte Username + Passwort eingeben.");
  if (password.length < 10) return showAdmin("Passwort muss mindestens 10 Zeichen haben.");

  const { res, data } = await api("/api/users/create", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok || !data?.ok) {
    showAdmin(data?.error || `Fehler (${res.status})`);
    return;
  }

  showAdmin("User erstellt ✅", true);
  createUserForm.reset();
});
