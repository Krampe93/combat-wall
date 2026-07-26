(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const worldId = params.get("world") || "unknown-world";
  const worldTitle = params.get("title") || "Foundry-Welt";
  const channel = new BroadcastChannel(`combat-wall:${worldId}`);

  const app = document.getElementById("app");
  const currentPanel = document.getElementById("current-panel");
  const currentImage = document.getElementById("current-image");
  const currentName = document.getElementById("current-name");
  const currentMeta = document.getElementById("current-meta");
  const currentStatuses = document.getElementById("current-statuses");
  const roundLabel = document.getElementById("round-label");
  const initiativeStrip = document.getElementById("initiative-strip");
  const groupsGrid = document.getElementById("groups-grid");
  const emptyState = document.getElementById("empty-state");
  const debugOutput = document.getElementById("debug-output");
  const connectionIndicator = document.getElementById("connection-indicator");
  const refreshButton = document.getElementById("refresh-button");
  const fullscreenButton = document.getElementById("fullscreen-button");

  let lastReceivedAt = 0;
  let requestTimer = null;
  let connectionTimer = null;

  document.title = `Combat Wall – ${worldTitle}`;

  channel.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "combat-state") return;

    lastReceivedAt = Date.now();
    render(message.payload);
    debugOutput.textContent = JSON.stringify(message.payload, null, 2);
    updateConnectionState();
  });

  refreshButton.addEventListener("click", requestState);
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);

  requestState();
  requestTimer = window.setInterval(requestState, 5000);
  connectionTimer = window.setInterval(updateConnectionState, 1000);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(requestTimer);
    window.clearInterval(connectionTimer);
    channel.close();
  });

  function requestState() {
    channel.postMessage({
      type: "request-state",
      requestedAt: Date.now()
    });
  }

  function render(state) {
    app.classList.remove("waiting");
    renderCurrent(state.current, state.combatActive);
    renderInitiative(state.initiative || []);
    renderGroups(state.groups || []);

    const activeText = state.combatActive
      ? `Runde ${state.round || 0}`
      : "Kein aktiver Kampf";
    roundLabel.textContent = activeText;

    const hasContent = Boolean(state.current || (state.groups || []).length || (state.initiative || []).length);
    emptyState.hidden = hasContent;
    groupsGrid.hidden = !hasContent;
  }

  function renderCurrent(current, combatActive) {
    currentStatuses.replaceChildren();

    if (!current) {
      currentPanel.classList.add("empty");
      currentImage.removeAttribute("src");
      currentName.textContent = combatActive ? "Kein aktiver Teilnehmer" : "Noch kein aktiver Zug";
      currentMeta.textContent = combatActive ? "Initiative vorhanden, aber noch niemand ausgewählt." : "Warte auf Foundry …";
      return;
    }

    currentPanel.classList.remove("empty");
    currentImage.src = current.image;
    currentImage.alt = current.name;
    currentName.textContent = current.name;

    if (current.kind === "npc") {
      currentMeta.textContent = `${current.groupName} · ${current.groupPosition ?? "?"}/${current.groupSize ?? "?"}`;
    } else {
      currentMeta.textContent = "Spielerzug";
    }

    for (const status of current.statuses || []) {
      currentStatuses.append(createStatusBadge(status));
    }
  }

  function renderInitiative(entries) {
    initiativeStrip.replaceChildren();

    for (const entry of entries) {
      const item = document.createElement("article");
      item.className = "initiative-entry";
      if (entry.active) item.classList.add("active");
      if (entry.defeated) item.classList.add("defeated");

      const image = document.createElement("img");
      image.src = entry.image;
      image.alt = "";

      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const meta = document.createElement("span");
      meta.textContent = entry.kind === "group"
        ? `${entry.activeMember ?? 0}/${entry.memberCount ?? 1}`
        : initiativeText(entry.initiative);

      copy.append(name, meta);
      item.append(image, copy);
      initiativeStrip.append(item);
    }
  }

  function renderGroups(groups) {
    groupsGrid.replaceChildren();
    groupsGrid.dataset.count = String(groups.length);

    for (const group of groups) {
      groupsGrid.append(createGroupCard(group));
    }
  }

  function createGroupCard(group) {
    const card = document.createElement("article");
    card.className = "group-card";
    if (group.allDefeated) card.classList.add("all-defeated");

    const background = document.createElement("img");
    background.className = "group-background";
    background.src = group.image;
    background.alt = "";

    const shade = document.createElement("div");
    shade.className = "group-shade";

    const header = document.createElement("header");
    header.className = "group-header";
    const title = document.createElement("h2");
    title.textContent = group.name;
    const count = document.createElement("span");
    count.textContent = `${group.living}/${group.total} aktiv`;
    header.append(title, count);

    const memberGrid = document.createElement("div");
    memberGrid.className = "member-grid";
    const layout = gridLayout(group.members.length);
    memberGrid.style.setProperty("--columns", String(layout.columns));
    memberGrid.style.setProperty("--rows", String(layout.rows));

    group.members.forEach((member, index) => {
      memberGrid.append(createMemberSegment(member, index + 1));
    });

    card.append(background, shade, header, memberGrid);
    return card;
  }

  function createMemberSegment(member, displayNumber) {
    const segment = document.createElement("section");
    segment.className = "member-segment";
    if (member.active) segment.classList.add("active");
    if (member.defeated) segment.classList.add("defeated");

    const number = document.createElement("span");
    number.className = "member-number";
    number.textContent = String(displayNumber);

    const labels = document.createElement("div");
    labels.className = "member-statuses";
    for (const status of member.statuses || []) {
      labels.append(createStatusBadge(status, true));
    }

    const state = document.createElement("span");
    state.className = "member-state";
    state.textContent = member.defeated ? "Besiegt" : member.active ? "Am Zug" : "";

    segment.append(number, labels, state);
    return segment;
  }

  function createStatusBadge(status, compact = false) {
    const badge = document.createElement("span");
    badge.className = compact ? "status-badge compact" : "status-badge";
    badge.title = readableStatus(status);
    badge.textContent = compact ? statusIcon(status) : `${statusIcon(status)} ${readableStatus(status)}`;
    return badge;
  }

  function readableStatus(status) {
    const labels = {
      poisoned: "Vergiftet",
      prone: "Liegend",
      restrained: "Festgesetzt",
      grappled: "Gepackt",
      stunned: "Betäubt",
      unconscious: "Bewusstlos",
      blinded: "Blind",
      frightened: "Verängstigt",
      charmed: "Bezaubert",
      incapacitated: "Handlungsunfähig",
      paralyzed: "Gelähmt",
      invisible: "Unsichtbar"
    };
    return labels[status] || status;
  }

  function statusIcon(status) {
    const icons = {
      poisoned: "☠",
      prone: "↘",
      restrained: "⛓",
      grappled: "✊",
      stunned: "✦",
      unconscious: "Zz",
      blinded: "◉",
      frightened: "!",
      charmed: "♥",
      incapacitated: "×",
      paralyzed: "║",
      invisible: "◌"
    };
    return icons[status] || "◆";
  }

  function gridLayout(count) {
    if (count <= 1) return { columns: 1, rows: 1 };
    if (count === 2) return { columns: 2, rows: 1 };
    if (count <= 4) return { columns: 2, rows: 2 };
    if (count <= 6) return { columns: 3, rows: 2 };
    if (count <= 9) return { columns: 3, rows: 3 };
    return { columns: 4, rows: Math.ceil(count / 4) };
  }

  function initiativeText(value) {
    return value === null || value === undefined ? "–" : `Ini ${value}`;
  }

  function updateConnectionState() {
    const age = lastReceivedAt ? Date.now() - lastReceivedAt : Infinity;
    connectionIndicator.classList.remove("connected", "stale", "waiting");

    if (age < 8000) {
      connectionIndicator.classList.add("connected");
      connectionIndicator.textContent = "Live verbunden";
    } else if (lastReceivedAt) {
      connectionIndicator.classList.add("stale");
      connectionIndicator.textContent = "Verbindung wartet";
    } else {
      connectionIndicator.classList.add("waiting");
      connectionIndicator.textContent = "Warte auf Daten";
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("Combat Wall | Vollbild konnte nicht umgeschaltet werden", error);
    }
  }

  function updateFullscreenButton() {
    fullscreenButton.textContent = document.fullscreenElement ? "Vollbild verlassen" : "Vollbild";
  }
})();
