(function () {
  const form = document.getElementById("loginForm");
  const u = document.getElementById("username");
  const p = document.getElementById("password");
  const err = document.getElementById("error");

  function showError(msg) {
    if (!err) return;
    err.style.display = msg ? "block" : "none";
    err.textContent = msg || "";
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const username = (u?.value || "").trim();
    const password = (p?.value || "").trim();
    if (!username || !password) return showError("Bitte Username + Passwort eingeben.");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    let data = null;
    try { data = await res.json(); } catch {}

    if (!res.ok || !data || data.ok !== true) {
      return showError((data && data.error) ? data.error : `Login fehlgeschlagen (${res.status})`);
    }

    location.href = "/app";
  });
})();
