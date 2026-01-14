// public/login.js
function $(sel) {
  return document.querySelector(sel);
}

function findUsernameInput() {
  return (
    $('input[name="username"]') ||
    $('#username') ||
    $('input[autocomplete="username"]') ||
    $('input[type="text"]')
  );
}

function findPasswordInput() {
  return (
    $('input[name="password"]') ||
    $('#password') ||
    $('input[autocomplete="current-password"]') ||
    $('input[type="password"]')
  );
}

function findForm() {
  // Nimm das erste Formular – oder das, in dem Username steckt
  const u = findUsernameInput();
  if (u && u.form) return u.form;
  return document.querySelector("form");
}

function setError(msg) {
  const box =
    document.querySelector('[data-error]') ||
    document.querySelector("#error") ||
    document.querySelector(".error") ||
    document.querySelector("#message");

  if (box) {
    box.textContent = msg;
    box.style.display = msg ? "block" : "none";
  } else if (msg) {
    alert(msg);
  }
}

async function apiMe() {
  const r = await fetch("/api/me", { credentials: "include" });
  return r.json();
}

async function login(username, password) {
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });

  let data = null;
  try { data = await r.json(); } catch (_) {}

  if (!r.ok || !data?.ok) {
    throw new Error(data?.error || `Login fehlgeschlagen (${r.status})`);
  }
  return data;
}

window.addEventListener("DOMContentLoaded", async () => {
  // Wenn schon eingeloggt -> direkt /app
  try {
    const me = await apiMe();
    if (me?.ok && me?.user) {
      location.href = "/app";
      return;
    }
  } catch (_) {}

  const form = findForm();
  const u = findUsernameInput();
  const p = findPasswordInput();

  if (!form || !u || !p) {
    console.error("Login: Form/Inputs nicht gefunden", { form, u, p });
    setError("Login-Formular kaputt: Inputs nicht gefunden.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const username = (u.value || "").trim();
    const password = (p.value || "").trim();

    if (!username || !password) {
      setError("Bitte Username + Passwort eingeben.");
      return;
    }

    try {
      await login(username, password);
      location.href = "/app";
    } catch (err) {
      setError(err.message || "Login fehlgeschlagen.");
    }
  });
});
