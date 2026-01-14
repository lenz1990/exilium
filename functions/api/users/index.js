<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Exilium – Dashboard</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="brand-title">EXILIUM</div>
        <span class="pill">Dashboard</span>
      </div>

      <button id="logoutBtn" class="btn btn-danger" type="button">Logout</button>
    </header>

    <main class="content">
      <div class="grid">
        <section class="card">
          <h2 class="card-title">Willkommen</h2>
          <div id="welcomeText" class="muted">Lade…</div>
        </section>

        <section id="adminCard" class="card" style="display:none;">
          <h2 class="card-title">Admin: User verwalten</h2>

          <div class="admin-split">
            <div>
              <h3 class="card-subtitle">User anlegen</h3>

              <form id="createUserForm" class="form">
                <label class="label">Neuer Username</label>
                <input id="newUsername" class="input" autocomplete="off" />

                <label class="label">Neues Passwort (min. 10 Zeichen)</label>
                <input id="newPassword" class="input" type="password" />

                <label class="checkbox">
                  <input id="newIsAdmin" type="checkbox" />
                  <span>Als Admin anlegen</span>
                </label>

                <button class="btn" type="submit">User erstellen</button>
              </form>

              <div id="createMsg" class="msg"></div>
            </div>

            <div>
              <div class="row row-between">
                <h3 class="card-subtitle">User-Liste</h3>
                <button id="refreshUsersBtn" class="btn btn-secondary" type="button">Aktualisieren</button>
              </div>

              <div id="usersMsg" class="msg"></div>

              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Admin</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody id="usersTbody">
                    <tr><td colspan="4" class="muted">Lade…</td></tr>
                  </tbody>
                </table>
              </div>

              <div class="hint muted">
                Hinweis: Du kannst deinen eigenen Account nicht löschen (und ID 1 ist geschützt).
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>

  <script type="module" src="/app.js"></script>
</body>
</html>
