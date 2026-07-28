(() => {
  "use strict";

  const DASHBOARD_VERSION = "0.7.2";
  console.log(`Combat Wall Dashboard ${DASHBOARD_VERSION} geladen.`);

  const params = new URLSearchParams(location.search);
  const worldId = params.get("world") || "unknown-world";
  const worldTitle = params.get("title") || "Foundry-Welt";
  const debugEnabled = params.get("debug") === "1";
  const channel = new BroadcastChannel(`combat-wall:${worldId}`);
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const currentPanel = $("current-panel");
  const currentImage = $("current-image");
  const currentName = $("current-name");
  const currentMeta = $("current-meta");
  const currentStatuses = $("current-statuses");
  const roundLabel = $("round-label");
  const initiativeStrip = $("initiative-strip");
  const groupsGrid = $("groups-grid");
  const emptyState = $("empty-state");
  const emptyTitle = $("empty-title");
  const emptyCopy = $("empty-copy");
  const debugPanel = $("debug-panel");
  const debugOutput = $("debug-output");
  const connectionIndicator = $("connection-indicator");
  const refreshButton = $("refresh-button");
  const fullscreenButton = $("fullscreen-button");

  let lastReceivedAt = 0;
  let lastStateSignature = "";
  let lastState = null;
  let lastInitiativeEntries = [];
  let initiativeFrame = 0;
  let groupLayoutFrame = 0;
  let layoutMode = "overview";
  let lastGroupLayoutSignature = "";
  let lastLayoutRows = [];

  document.title = `Combat Wall – ${worldTitle}`;
  debugPanel.hidden = !debugEnabled;

  channel.addEventListener("message", ({ data }) => {
    if (!data || data.type !== "combat-state") return;
    lastReceivedAt = Date.now();
    const signature = stableStringify(data.payload);
    if (signature !== lastStateSignature) {
      lastStateSignature = signature;
      lastState = data.payload;
      render(data.payload);
      if (debugEnabled) debugOutput.textContent = JSON.stringify(data.payload, null, 2);
    }
    updateConnectionState();
  });

  refreshButton.addEventListener("click", requestState);
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  const resizeObserver = new ResizeObserver(scheduleInitiativeRender);
  resizeObserver.observe(initiativeStrip);
  const groupResizeObserver = new ResizeObserver(scheduleGroupRender);
  groupResizeObserver.observe(groupsGrid);

  requestState();
  const requestTimer = setInterval(requestState, 5000);
  const connectionTimer = setInterval(updateConnectionState, 1000);
  addEventListener("beforeunload", () => {
    clearInterval(requestTimer);
    clearInterval(connectionTimer);
    cancelAnimationFrame(initiativeFrame);
    cancelAnimationFrame(groupLayoutFrame);
    resizeObserver.disconnect();
    groupResizeObserver.disconnect();
    channel.close();
  });

  function requestState() {
    channel.postMessage({ type: "request-state", requestedAt: Date.now() });
  }

  function render(state) {
    app.classList.remove("waiting");
    const groups = state.groups || [];
    layoutMode = state.current?.kind === "npc" ? "focus" : "overview";
    renderCurrent(state.current, state.combatActive);
    lastInitiativeEntries = state.initiative || [];
    scheduleInitiativeRender();
    renderGroups(groups, state.current);
    roundLabel.textContent = state.combatActive ? `Runde ${state.round || 0}` : "Kein aktiver Kampf";
    const empty = groups.length === 0;
    emptyState.hidden = !empty;
    groupsGrid.hidden = empty;
    if (!state.combatActive) {
      emptyTitle.textContent = "Combat Wall wartet auf einen Kampf";
      emptyCopy.textContent = "Starte einen Encounter in Foundry.";
    } else if (empty) {
      emptyTitle.textContent = "Keine Gegner im Encounter";
      emptyCopy.textContent = "Die Initiative enthält derzeit nur Spieler-Placeholder.";
    }
  }

  function renderCurrent(current, combatActive) {
    if (!current) {
      currentPanel.classList.add("empty");
      currentPanel.dataset.kind = "none";
      currentImage.removeAttribute("src");
      currentName.textContent = combatActive ? "Kein aktiver Teilnehmer" : "Noch kein aktiver Zug";
      currentMeta.textContent = combatActive ? "Initiative vorhanden, aber noch niemand ausgewählt." : "Warte auf Foundry …";
      reconcileStatuses(currentStatuses, []);
      return;
    }
    currentPanel.classList.remove("empty");
    currentPanel.dataset.kind = current.kind;
    setImage(currentImage, current.image);
    currentImage.alt = current.name;
    currentName.textContent = current.name;
    currentMeta.textContent = current.kind === "npc"
      ? `${current.groupName} · ${current.groupPosition ?? "?"} von ${current.groupSize ?? "?"}`
      : "Spielerzug";
    reconcileStatuses(currentStatuses, current.statuses || []);
  }

  function scheduleInitiativeRender() {
    cancelAnimationFrame(initiativeFrame);
    initiativeFrame = requestAnimationFrame(renderUpcomingInitiative);
  }

  function renderUpcomingInitiative() {
    const upcoming = rotateAfterActive(lastInitiativeEntries);
    const capacity = initiativeCapacity(upcoming.length);
    const visible = upcoming.slice(0, capacity.visibleCount);
    const wanted = new Set(visible.map((entry) => entry.id));
    for (const node of initiativeStrip.querySelectorAll(".initiative-entry")) {
      if (!wanted.has(node.dataset.entryId)) node.remove();
    }
    for (const entry of visible) {
      let item = Array.from(initiativeStrip.querySelectorAll(".initiative-entry"))
        .find((node) => node.dataset.entryId === entry.id);
      if (!item) item = createInitiativeEntry(entry);
      updateInitiativeEntry(item, entry);
      initiativeStrip.append(item);
    }
    initiativeStrip.querySelector(".initiative-overflow")?.remove();
    if (capacity.hiddenCount) {
      const more = document.createElement("span");
      more.className = "initiative-overflow";
      more.textContent = `+${capacity.hiddenCount}`;
      more.title = `${capacity.hiddenCount} weitere Initiativeeinträge`;
      initiativeStrip.append(more);
    }
  }

  function createInitiativeEntry(entry) {
    const item = document.createElement("article");
    item.className = "initiative-entry";
    item.dataset.entryId = entry.id;
    const image = document.createElement("img");
    const copy = document.createElement("div");
    copy.append(document.createElement("strong"), document.createElement("span"));
    item.append(image, copy);
    return item;
  }

  function updateInitiativeEntry(item, entry) {
    item.dataset.kind = entry.kind;
    item.classList.toggle("defeated", Boolean(entry.defeated));
    const image = item.querySelector("img");
    setImage(image, entry.image);
    image.alt = "";
    item.querySelector("strong").textContent = entry.name;
    item.querySelector("span").textContent =
      entry.kind === "group" ? opponentCountText(entry.memberCount ?? 1) : "Spieler";
  }

  function rotateAfterActive(entries) {
    if (!entries.length) return [];
    const activeIndex = entries.findIndex((entry) => entry.active);
    return activeIndex < 0 ? entries : entries.slice(activeIndex + 1).concat(entries.slice(0, activeIndex));
  }

  function initiativeCapacity(entryCount) {
    const style = getComputedStyle(initiativeStrip);
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const availableWidth = Math.max(0, initiativeStrip.clientWidth - padding);
    const cardWidth = 185;
    const overflowWidth = 58;
    let visibleCount = Math.min(entryCount, Math.floor((availableWidth + gap) / (cardWidth + gap)));
    if (visibleCount < entryCount) {
      visibleCount = Math.max(0, Math.floor((availableWidth - overflowWidth) / (cardWidth + gap)));
    }
    return { visibleCount, hiddenCount: Math.max(0, entryCount - visibleCount), availableWidth, cardWidth, gap };
  }

  function renderGroups(groups, current) {
    groupsGrid.dataset.layoutMode = layoutMode;
    groupsGrid.dataset.count = String(groups.length);
    const signature = groupLayoutSignature(groups, current);
    if (signature === lastGroupLayoutSignature) {
      updateLiveGroupDetails(groups, current);
      return;
    }
    lastGroupLayoutSignature = signature;
    groupsGrid.replaceChildren();
    if (layoutMode === "focus") {
      renderFocus(groups, current);
      return;
    }
    const layout = calculateWeightedLayout(
      groups,
      groupsGrid.clientWidth || 1280,
      groupsGrid.clientHeight || 640,
      "overview"
    );
    lastLayoutRows = layout;
    for (const item of layout) {
      const card = createGroupCard(item.group);
      card.dataset.groupId = item.group.id;
      applyLayoutRect(card, item);
      groupsGrid.append(card);
    }
  }

  function scheduleGroupRender() {
    cancelAnimationFrame(groupLayoutFrame);
    groupLayoutFrame = requestAnimationFrame(() => {
      lastGroupLayoutSignature = "";
      if (lastState) renderGroups(lastState.groups || [], lastState.current);
    });
  }

  function groupLayoutSignature(groups, current) {
    return JSON.stringify({
      mode: layoutMode,
      width: Math.round(groupsGrid.clientWidth),
      height: Math.round(groupsGrid.clientHeight),
      activeGroup: current?.groupId ?? null,
      groups: groups.map((group) => ({
        id: group.id,
        weight: group.layoutWeight,
        effectiveWeight: group.effectiveLayoutWeight,
        size: group.creatureSize || group.size,
        members: group.members?.map((member) => member.id)
      }))
    });
  }

  function calculateWeightedLayout(groups, width, height, mode = "overview") {
    if (!groups.length || width <= 0 || height <= 0) return [];
    const gap = Math.max(8, Math.min(16, width * 0.01));
    const minWidth = 180;
    const minHeight = 128;
    const maxColumnsByWidth = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
    const maxRowsByHeight = Math.max(1, Math.floor((height + gap) / (minHeight + gap)));
    const preferredColumns = groups.length <= 2 ? groups.length : groups.length <= 4 ? 2 : 5;
    const columns = Math.max(1, Math.min(preferredColumns, maxColumnsByWidth));
    const preferredRows = groups.length <= 2 ? 1 : groups.length <= 4 ? 2 : 3;
    const rows = Math.max(1, Math.min(maxRowsByHeight, Math.max(preferredRows, Math.ceil(groups.length / columns))));
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    const occupied = Array.from({ length: rows }, () => Array(columns).fill(false));
    const sorted = groups.map((group, index) => ({ group, index }))
      .sort((a, b) => normalizedLayoutWeight(b.group.effectiveLayoutWeight) -
        normalizedLayoutWeight(a.group.effectiveLayoutWeight) || a.index - b.index);
    const packed = [];

    for (const entry of sorted) {
      const weight = normalizedLayoutWeight(entry.group.effectiveLayoutWeight);
      const preferred = groups.length <= 4
        ? [1, 1]
        : groups.length > 6
        ? (weight >= 1.75 ? [2, 1] : [1, 1])
        : (weight >= 1.75 ? [2, 2] : weight >= 1.2 ? [2, 1] : [1, 1]);
      const choices = [preferred, preferred[0] > 1 ? [1, preferred[1]] : null, [1, 1]].filter(Boolean);
      let placement = null;
      for (const [columnSpan, rowSpan] of choices) {
        placement = findGridSpace(occupied, columnSpan, rowSpan);
        if (placement) {
          placement.columnSpan = columnSpan;
          placement.rowSpan = rowSpan;
          break;
        }
      }
      if (!placement) continue;
      occupyGridSpace(occupied, placement);
      const assignedWidth = cellWidth * placement.columnSpan + gap * (placement.columnSpan - 1);
      const assignedHeight = cellHeight * placement.rowSpan + gap * (placement.rowSpan - 1);
      packed.push({
        group: entry.group,
        x: placement.column * (cellWidth + gap),
        y: placement.row * (cellHeight + gap),
        width: assignedWidth,
        height: assignedHeight,
        row: placement.row + 1,
        column: placement.column + 1,
        columnSpan: placement.columnSpan,
        rowSpan: placement.rowSpan,
        minWidth,
        minHeight,
        maxWidth: width,
        minWidthApplied: assignedWidth >= minWidth,
        minHeightApplied: assignedHeight >= minHeight,
        packingStrategy: "weighted-mosaic-grid",
        clamped: placement.columnSpan !== preferred[0] || placement.rowSpan !== preferred[1],
        slot: `r${placement.row + 1}c${placement.column + 1}`,
        mode,
        fallback: entry.group.sizeSource === "fallback"
      });
    }
    return packed.sort((a, b) => a.row - b.row || a.column - b.column);
  }

  function findGridSpace(occupied, columnSpan, rowSpan) {
    const rows = occupied.length;
    const columns = occupied[0]?.length ?? 0;
    for (let row = 0; row <= rows - rowSpan; row += 1) {
      for (let column = 0; column <= columns - columnSpan; column += 1) {
        let free = true;
        for (let y = row; y < row + rowSpan && free; y += 1) {
          for (let x = column; x < column + columnSpan; x += 1) {
            if (occupied[y][x]) { free = false; break; }
          }
        }
        if (free) return { row, column };
      }
    }
    return null;
  }

  function occupyGridSpace(occupied, placement) {
    for (let row = placement.row; row < placement.row + placement.rowSpan; row += 1) {
      for (let column = placement.column; column < placement.column + placement.columnSpan; column += 1) {
        occupied[row][column] = true;
      }
    }
  }

  function applyLayoutRect(node, item) {
    node.style.position = "absolute";
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.style.width = `${item.width}px`;
    node.style.height = `${item.height}px`;
  }

  function updateLiveGroupDetails(groups, current) {
    for (const group of groups) {
      const card = groupsGrid.querySelector(`[data-group-id="${CSS.escape(group.id)}"]`);
      if (!card) continue;
      const count = card.querySelector(".group-header span");
      if (count) count.textContent = `${group.living}/${group.total} aktiv`;
      for (const member of group.members || []) {
        const segment = card.querySelector(`[data-combatant-id="${CSS.escape(member.id)}"]`);
        if (!segment) continue;
        const replacement = createMemberSegment(member);
        segment.replaceWith(replacement);
      }
    }
    if (layoutMode === "focus" && current) {
      const activeGroup = groups.find((group) => group.id === current.groupId);
      const activeMember = activeGroup?.members?.find((member) => member.id === current.id);
      const focusCard = groupsGrid.querySelector(".focus-card");
      const focusImage = focusCard?.querySelector(".focus-image");
      const focusTitle = focusCard?.querySelector(".focus-header h2");
      const focusProgress = focusCard?.querySelector(".focus-header span");
      if (focusImage && activeMember) setImage(focusImage, activeMember.image || activeGroup.image);
      if (focusTitle && activeMember) focusTitle.textContent = activeMember.name || activeGroup.name;
      if (focusProgress && activeGroup) {
        focusProgress.textContent =
          `${activeGroup.name} · ${activeGroup.activeGroupPosition ?? activeGroup.activeMember ?? "?"} von ${activeGroup.activeGroupCount ?? activeGroup.actionableMembers ?? activeGroup.total}`;
      }
      const overlay = groupsGrid.querySelector(".focus-overlay");
      if (overlay && activeMember) overlay.replaceWith(createFocusOverlay(activeMember));
    }
  }

  function renderFocus(groups, current) {
    const activeGroup = groups.find((group) => group.id === current?.groupId);
    const activeMember = activeGroup?.members?.find((member) => member.id === current?.id);
    if (!activeGroup || !activeMember) {
      layoutMode = "overview";
      renderGroups(groups, null);
      return;
    }
    const remaining = groups.filter((group) => group.id !== activeGroup.id)
      .sort((a, b) => normalizedLayoutWeight(b.effectiveLayoutWeight) - normalizedLayoutWeight(a.effectiveLayoutWeight));
    const left = [];
    const right = [];
    let leftWeight = 0;
    let rightWeight = 0;
    for (const group of remaining) {
      if (leftWeight <= rightWeight) {
        left.push(group);
        leftWeight += normalizedLayoutWeight(group.effectiveLayoutWeight);
      } else {
        right.push(group);
        rightWeight += normalizedLayoutWeight(group.effectiveLayoutWeight);
      }
    }
    groupsGrid.append(
      createFocusRail("left", left),
      createFocusCard(activeGroup, activeMember),
      createFocusRail("right", right)
    );
    lastLayoutRows = collectRenderedLayout(groupsGrid, "focus");
  }

  function createFocusRail(side, groups) {
    const rail = document.createElement("div");
    rail.className = `focus-rail focus-rail-${side}`;
    rail.style.gridTemplateRows = groups
      .map((group) => `${normalizedLayoutWeight(group.effectiveLayoutWeight)}fr`)
      .join(" ");
    for (const group of groups) rail.append(createGroupCard(group, true));
    return rail;
  }

  function createFocusCard(group, member) {
    const card = document.createElement("article");
    card.className = "focus-card";
    const image = document.createElement("img");
    image.className = "focus-image";
    setImage(image, member.image || group.image);
    image.alt = member.name || group.name;
    const shade = document.createElement("div");
    shade.className = "focus-shade";
    const header = document.createElement("header");
    header.className = "focus-header";
    const title = document.createElement("h2");
    title.textContent = member.name || group.name;
    const progress = document.createElement("span");
    progress.textContent =
      `${group.name} · ${group.activeGroupPosition ?? group.activeMember ?? "?"} von ${group.activeGroupCount ?? group.actionableMembers ?? group.total}`;
    header.append(title, progress);
    card.append(image, shade, header, createFocusOverlay(member));
    return card;
  }

  function createFocusOverlay(member) {
    const overlay = document.createElement("section");
    overlay.className = "focus-overlay";
    overlay.dataset.combatantId = member.id;
    overlay.classList.toggle("defeated", Boolean(member.defeated));
    const direction = createDirectionIndicator(member, "focus-direction");
    const statuses = document.createElement("div");
    statuses.className = "member-statuses focus-statuses";
    for (const status of member.statuses || []) statuses.append(createStatusBadge(status, true));
    const state = document.createElement("span");
    state.className = "member-state focus-state";
    state.textContent = member.defeated ? "Besiegt" : "Am Zug";
    overlay.append(direction, statuses, state);
    return overlay;
  }

  function createGroupCard(group, compact = false) {
    const card = document.createElement("article");
    card.className = "group-card";
    card.classList.toggle("compact", compact);
    card.classList.toggle("all-defeated", Boolean(group.allDefeated));
    card.dataset.groupId = group.id;
    card.dataset.creatureSize = group.creatureSize || group.size || "medium";
    card.style.setProperty("--layout-weight", String(normalizedLayoutWeight(group.effectiveLayoutWeight)));
    const background = document.createElement("img");
    background.className = "group-background";
    setImage(background, group.image);
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
    const layout = memberGridLayout(group.members.length);
    memberGrid.style.setProperty("--columns", String(layout.columns));
    memberGrid.style.setProperty("--rows", String(layout.rows));
    for (const member of group.members) memberGrid.append(createMemberSegment(member));
    card.append(background, shade, header, memberGrid);
    return card;
  }

  function createMemberSegment(member) {
    const segment = document.createElement("section");
    segment.className = "member-segment";
    segment.dataset.combatantId = member.id;
    segment.classList.toggle("active", Boolean(member.active));
    segment.classList.toggle("defeated", Boolean(member.defeated));
    const direction = createDirectionIndicator(member);
    const statuses = document.createElement("div");
    statuses.className = "member-statuses";
    for (const status of member.statuses || []) statuses.append(createStatusBadge(status, true));
    const state = document.createElement("span");
    state.className = "member-state";
    state.textContent = member.defeated ? "Besiegt" : member.active ? "Am Zug" : "";
    segment.append(direction, statuses, state);
    return segment;
  }

  function createDirectionIndicator(member, additionalClass = "") {
    const anchor = document.createElement("span");
    anchor.className = `direction-anchor ${additionalClass}`.trim();
    anchor.dataset.state = member.directionState || "unavailable";
    const direction = document.createElement("span");
    direction.className = "direction-indicator";
    if (member.directionState === "center") {
      direction.textContent = "◎";
      anchor.setAttribute("aria-label", "Nahe der Szenenmitte");
    } else if (member.directionState === "direction" && Number.isFinite(member.directionAngle)) {
      direction.textContent = "➤";
      direction.style.setProperty("--direction-angle", `${member.directionAngle}deg`);
      anchor.setAttribute("aria-label", "Richtung von der Szenenmitte");
    } else anchor.hidden = true;
    anchor.append(direction);
    return anchor;
  }

  function createStatusBadge(status, compact = false) {
    const badge = document.createElement("span");
    badge.className = compact ? "status-badge compact" : "status-badge";
    badge.title = readableStatus(status);
    badge.textContent = compact ? statusIcon(status) : `${statusIcon(status)} ${readableStatus(status)}`;
    return badge;
  }

  function reconcileStatuses(container, statuses) {
    const signature = statuses.join("|");
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    container.replaceChildren(...statuses.map((status) => createStatusBadge(status)));
  }

  function readableStatus(status) {
    return ({ poisoned: "Vergiftet", prone: "Liegend", restrained: "Festgesetzt", grappled: "Gepackt",
      stunned: "Betäubt", unconscious: "Bewusstlos", blinded: "Blind", frightened: "Verängstigt",
      charmed: "Bezaubert", incapacitated: "Handlungsunfähig", paralyzed: "Gelähmt", invisible: "Unsichtbar" })[status] || status;
  }

  function statusIcon(status) {
    return ({ poisoned: "☠", prone: "↘", restrained: "⛓", grappled: "✊", stunned: "✦",
      unconscious: "Zz", blinded: "◉", frightened: "!", charmed: "♥", incapacitated: "×",
      paralyzed: "║", invisible: "○" })[status] || "◆";
  }

  function memberGridLayout(count) {
    if (count <= 1) return { columns: 1, rows: 1 };
    if (count === 2) return { columns: 2, rows: 1 };
    if (count <= 4) return { columns: 2, rows: 2 };
    if (count <= 6) return { columns: 3, rows: 2 };
    if (count <= 9) return { columns: 3, rows: 3 };
    return { columns: 4, rows: Math.ceil(count / 4) };
  }

  function groupGridLayout(count) {
    if (count <= 1) return { columns: 1, rows: 1 };
    if (count === 2) return { columns: 2, rows: 1 };
    if (count <= 4) return { columns: count, rows: 1 };
    if (count <= 6) return { columns: 3, rows: 2 };
    if (count <= 8) return { columns: 4, rows: 2 };
    if (count <= 9) return { columns: 3, rows: 3 };
    return { columns: 4, rows: Math.ceil(count / 4) };
  }

  function chunkGroups(groups, columns) {
    const rows = [];
    for (let index = 0; index < groups.length; index += columns) rows.push(groups.slice(index, index + columns));
    return rows;
  }

  function normalizedLayoutWeight(value) {
    const weight = Number(value);
    return Number.isFinite(weight) ? Math.min(2.3, Math.max(0.65, weight)) : 1;
  }

  function collectRenderedLayout(container, mode) {
    const bounds = container.getBoundingClientRect();
    return Array.from(container.querySelectorAll(".group-card")).map((card, index) => {
      const rect = card.getBoundingClientRect();
      const group = lastState?.groups?.find((entry) => entry.id === card.dataset.groupId);
      return {
        group,
        x: rect.left - bounds.left,
        y: rect.top - bounds.top,
        width: rect.width,
        height: rect.height,
        minWidth: 150,
        minHeight: 120,
        maxWidth: bounds.width * 0.56,
        clamped: false,
        fallback: group?.sizeSource === "fallback",
        slot: `${mode}-${index + 1}`,
        mode
      };
    });
  }

  function opponentCountText(count) {
    return count === 1 ? "1 Gegner" : `${count} Gegner`;
  }

  function setImage(image, source) {
    if (source && image.getAttribute("src") !== source) image.src = source;
  }

  function stableStringify(value) {
    return JSON.stringify(value, (key, item) => key === "generatedAt" || key === "sentAt" ? undefined : item);
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
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error("Combat Wall | Vollbild konnte nicht umgeschaltet werden", error);
    }
  }

  function updateFullscreenButton() {
    fullscreenButton.textContent = document.fullscreenElement ? "Vollbild verlassen" : "Vollbild";
  }

  window.CombatWallDashboard = {
    inspectLayout() {
      const capacity = initiativeCapacity(rotateAfterActive(lastInitiativeEntries).length);
      const details = {
        layoutMode,
        containerWidth: capacity.availableWidth,
        cardWidth: capacity.cardWidth,
        gap: capacity.gap,
        visibleInitiativeCards: capacity.visibleCount,
        activeCombatantId: lastState?.current?.id ?? null,
        activeGroupId: lastState?.current?.groupId ?? null,
        activeTokenId: lastState?.current?.tokenId ?? null,
        activeDirectionAngle: lastState?.current?.directionAngle ?? null,
        opponentGroups: lastState?.groups?.length ?? 0
      };
      console.table([details]);
      const rows = lastLayoutRows.map((item) => ({
        Name: item.group?.name ?? "Unbekannt",
        groupId: item.group?.id ?? null,
        actorSizeRaw: item.group?.actorSizeRaw ?? null,
        creatureSizeNormalized: item.group?.creatureSize ?? item.group?.size ?? "medium",
        sizeSource: item.group?.sizeSource ?? "fallback",
        layoutWeight: item.group?.layoutWeight ?? 1,
        minimumWidth: Math.round(item.minWidth ?? 0),
        maximumWidth: Math.round(item.maxWidth ?? 0),
        assignedWidth: Math.round(item.width ?? 0),
        assignedHeight: Math.round(item.height ?? 0),
        assignedArea: Math.round((item.width ?? 0) * (item.height ?? 0)),
        row: item.row ?? null,
        column: item.column ?? null,
        columnSpan: item.columnSpan ?? 1,
        rowSpan: item.rowSpan ?? 1,
        layoutMode: item.mode ?? layoutMode,
        layoutPosition: item.slot ?? null,
        minWidthApplied: Boolean(item.minWidthApplied),
        minHeightApplied: Boolean(item.minHeightApplied),
        packingStrategy: item.packingStrategy ?? "focus-rails",
        clampApplied: Boolean(item.clamped),
        fallbackApplied: Boolean(item.fallback)
      }));
      console.table(rows);
      return rows;
    }
  };
})();
