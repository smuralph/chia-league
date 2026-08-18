async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  return res.json();
}

function setUpdated(dateStr) {
  const el = document.getElementById("updated");
  if (el) el.textContent = `Last updated ${dateStr}`;
}

function renderStandings(data) {
  const body = document.getElementById("standings-body");
  if (!body) return;

  const sorted = [...data.teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  body.innerHTML = sorted
    .map(
      (t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.name}</td>
        <td>${t.owner}</td>
        <td>${t.wins}</td>
        <td>${t.losses}</td>
        <td>${t.ties}</td>
        <td>${t.pointsFor}</td>
        <td>${t.pointsAgainst}</td>
      </tr>`
    )
    .join("");
}

function renderTeams(data) {
  const list = document.getElementById("teams-list");
  if (!list) return;

  list.innerHTML = data.teams
    .map(
      (t) => `
      <div class="team-card">
        <h3>${t.name}</h3>
        <p>Owner: ${t.owner}</p>
        <p>Record: ${t.wins}-${t.losses}-${t.ties}</p>
        <p>PF ${t.pointsFor} · PA ${t.pointsAgainst}</p>
      </div>`
    )
    .join("");
}

loadData()
  .then((data) => {
    setUpdated(data.updated);
    renderStandings(data);
    renderTeams(data);
  })
  .catch((err) => {
    console.error("Failed to load data.json", err);
  });
