async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

(async () => {
  const me = await api("/api/me");
  if (!me.data?.user) {
    location.href = "/login.html";
    return;
  }

  const user = me.data.user;
  document.getElementById("who").textContent =
    `Eingeloggt als ${user.username}` + (user.is_admin ? " (Admin)" : "");

  document.getElementById("logout").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    location.href = "/login.html";
  });

  if (user.is_admin) {
    document.getElementById("adminCard").style.display = "block";
    const msg = document.getElementById("msg");
    const show = (t, ok=true) => {
      msg.style.display = "block";
      msg.textContent = t;
      msg.className = "notice small " + (ok ? "ok" : "err");
    };

    document.getElementById("createUser").addEventListener("click", async () => {
      const username = document.getElementById("nu").value.trim();
      const password = document.getElementById("np").value;

      const { res, data } = await api("/api/users/create", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok || !data?.ok) return show(data?.error || "Fehler", false);
      show("User erstellt ✅", true);
      document.getElementById("nu").value = "";
      document.getElementById("np").value = "";
    });
  }
})();
