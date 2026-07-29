const MODULE_ID = "combat-wall";
const MODULE_TITLE = "Combat Wall";
const MODULE_VERSION = "1.0.1";
const PLAYER_IMAGE_SETTING = "playerFocusImages";
const CHANNEL_PREFIX = "combat-wall";
const UPDATE_DEBOUNCE_MS = 80;
const GROUP_SYNC_DEBOUNCE_MS = 160;
const MARKER_EDGE_PERCENT = 3;
const MARKER_COLORS = Object.freeze([
  "#37d5ff", "#ff4fd8", "#ffd447", "#65e572",
  "#a878ff", "#ff8247", "#4d7dff", "#ff6685"
]);
const SIZE_WEIGHTS = Object.freeze({
  tiny: 0.65,
  small: 0.8,
  medium: 1,
  large: 1.4,
  huge: 1.8,
  gargantuan: 2.3
});

let channel = null;
let updateTimer = null;
let groupSyncTimer = null;
let groupSyncRunning = false;
let lastStateSignature = "";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, PLAYER_IMAGE_SETTING, {
    name: "Spieler-Fokusbilder",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
  console.log(`${MODULE_TITLE} ${MODULE_VERSION} ist aktiv.`);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;

  initializeChannel();
  installDashboardButton();
  registerUpdateHooks();
  exposeDebugApi();
  scheduleCombatRefresh("ready", 0, true);

  ui.notifications?.info(`${MODULE_TITLE} ${MODULE_VERSION} ist aktiv.`);
});

function initializeChannel() {
  const channelName = getChannelName();
  channel = new BroadcastChannel(channelName);

  channel.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;

    if (message.type === "request-state") {
      scheduleBroadcast("dashboard-request", 0, true);
    }
  });

  console.log(`${MODULE_TITLE} | BroadcastChannel geöffnet: ${channelName}`);
}

function getChannelName() {
  return `${CHANNEL_PREFIX}:${game.world?.id ?? "unknown-world"}`;
}

function registerUpdateHooks() {
  const hookNames = [
    "combatStart",
    "combatTurn",
    "combatTurnChange",
    "createCombat",
    "updateCombat",
    "deleteCombat",
    "createCombatant",
    "deleteCombatant",
    "createCombatantGroup",
    "updateCombatantGroup",
    "deleteCombatantGroup",
    "updateActor",
    "createActiveEffect",
    "updateActiveEffect",
    "deleteActiveEffect",
    "updateToken",
    "canvasReady"
  ];

  for (const hookName of hookNames) {
    Hooks.on(hookName, () => scheduleCombatRefresh(hookName));
  }

  Hooks.on("updateCombatant", (combatant, changed, options) => {
    const initiative = numberOrNull(changed?.initiative);
    const preferredInitiatives = new Map();
    if (!options?.combatWallGroupSync && initiative !== null) {
      const groupId = resolveCombatantGroupId(combatant);
      if (groupId) preferredInitiatives.set(groupId, initiative);
    }
    scheduleCombatRefreshWithInitiatives("updateCombatant", preferredInitiatives);
  });
}

function exposeDebugApi() {
  window.CombatWall = {
    openDashboard,
    getState: buildDashboardState,
    broadcast: () => broadcastState("manual", true),
    synchronizeGroups: () => synchronizeNpcGroups(game.combat),
    getDashboardUrl,
    inspectCombatants,
    inspectPublicInitiative,
    inspectMarkers,
    getMarkerData,
    getGroupMarkerData,
    configurePlayerImages: openPlayerImageDialog,
    inspectPlayerImages,
    inspectLayout: () => {
      const state = buildDashboardState();
      const rows = state.groups.map((group) => ({
        Name: group.name,
        "Group ID": group.id,
        actorSizeRaw: group.actorSizeRaw,
        "Creature Size": group.creatureSize,
        "Size Source": group.sizeSource,
        "Layout Weight": group.layoutWeight,
        "Layout Mode": state.focusModeVariant ?? "focus-player"
      }));
      console.table(rows);
      return rows;
    }
  };
}

function installDashboardButton() {
  if (document.getElementById("combat-wall-open")) return;

  const button = document.createElement("button");
  button.id = "combat-wall-open";
  button.type = "button";
  button.title = "Combat Wall auf dem zweiten Bildschirm öffnen";
  button.innerHTML = '<i class="fa-solid fa-display"></i><span>Combat Wall</span>';
  document.body.appendChild(button);
  installDraggableButton(button);
}

const BUTTON_POSITION_KEY = `${MODULE_ID}.button-position`;
const BUTTON_DRAG_THRESHOLD = 5;

function installDraggableButton(button) {
  let pointer = null;
  let dragged = false;

  restoreButtonPosition(button);
  window.addEventListener("resize", () => clampButtonPosition(button));

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    dragged = false;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (!dragged && distance < BUTTON_DRAG_THRESHOLD) return;
    dragged = true;
    event.preventDefault();
    setButtonPosition(button, event.clientX - pointer.offsetX, event.clientY - pointer.offsetY);
  });

  const finish = (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (dragged) saveButtonPosition(button);
    pointer = null;
    window.setTimeout(() => { dragged = false; }, 0);
  };
  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", finish);
  button.addEventListener("click", (event) => {
    if (dragged) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    openDashboard();
  });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (!event.shiftKey) {
      openPlayerImageDialog();
      return;
    }
    localStorage.removeItem(BUTTON_POSITION_KEY);
    applyDefaultButtonPosition(button);
  });
}

async function openPlayerImageDialog() {
  const placeholders = Array.from(game.combat?.combatants?.contents ?? [])
    .filter((combatant) => classifyCombatant(combatant, combatant.actor, combatant.token) !== "npc");
  if (!placeholders.length) {
    ui.notifications?.warn("Im aktuellen Kampf gibt es keine Spieler-Placeholder.");
    return;
  }
  const mapping = getPlayerImageMapping();
  const options = placeholders
    .map((combatant) => `<option value="${combatant.id}">${escapeHtml(combatant.name ?? "Spieler")}</option>`)
    .join("");
  const content = `
    <form class="combat-wall-player-image-form">
      <div class="form-group"><label>Spieler</label><select name="combatantId">${options}</select></div>
      <div class="form-group"><label>Bild</label>
        <div class="form-fields"><input type="text" name="image" value="">
        <button type="button" data-action="browse"><i class="fa-solid fa-file-import"></i></button></div>
      </div>
      <p class="notes">Rechtsklick öffnet diese Zuordnung. Umschalt + Rechtsklick setzt die Buttonposition zurück.</p>
    </form>`;
  const dialog = new Dialog({
    title: "Combat Wall – Spielerbild",
    content,
    buttons: {
      save: {
        icon: '<i class="fa-solid fa-floppy-disk"></i>',
        label: "Speichern",
        callback: async (html) => {
          const id = html.find('[name="combatantId"]').val();
          const combatant = placeholders.find((entry) => entry.id === id);
          const image = String(html.find('[name="image"]').val() ?? "").trim();
          if (!combatant) return;
          const next = { ...getPlayerImageMapping() };
          const key = normalizedPlayerKey(combatant.name);
          if (image) next[key] = image;
          else delete next[key];
          await game.settings.set(MODULE_ID, PLAYER_IMAGE_SETTING, next);
          scheduleBroadcast("player-image", 0, true);
        }
      },
      remove: {
        icon: '<i class="fa-solid fa-trash"></i>',
        label: "Entfernen",
        callback: async (html) => {
          const id = html.find('[name="combatantId"]').val();
          const combatant = placeholders.find((entry) => entry.id === id);
          if (!combatant) return;
          const next = { ...getPlayerImageMapping() };
          delete next[normalizedPlayerKey(combatant.name)];
          await game.settings.set(MODULE_ID, PLAYER_IMAGE_SETTING, next);
          scheduleBroadcast("player-image-remove", 0, true);
        }
      }
    },
    render: (html) => {
      const select = html.find('[name="combatantId"]');
      const input = html.find('[name="image"]');
      const refresh = () => {
        const combatant = placeholders.find((entry) => entry.id === select.val());
        input.val(mapping[normalizedPlayerKey(combatant?.name)] ?? "");
      };
      select.on("change", refresh);
      html.find('[data-action="browse"]').on("click", () => {
        new FilePicker({
          type: "image",
          current: input.val(),
          callback: (path) => input.val(path)
        }).browse();
      });
      refresh();
    }
  });
  dialog.render(true);
}

function getPlayerImageMapping() {
  return game.settings?.get(MODULE_ID, PLAYER_IMAGE_SETTING) ?? {};
}

function normalizedPlayerKey(name) {
  return slugify(String(name ?? "spieler"));
}

function inspectPlayerImages() {
  const mapping = getPlayerImageMapping();
  const rows = Object.entries(mapping).map(([playerKey, image]) => ({ playerKey, image }));
  console.table(rows);
  return rows;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function applyDefaultButtonPosition(button) {
  button.style.left = "12px";
  button.style.top = "auto";
  button.style.bottom = "76px";
  clampButtonPosition(button);
}

function restoreButtonPosition(button) {
  try {
    const saved = JSON.parse(localStorage.getItem(BUTTON_POSITION_KEY));
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
      setButtonPosition(button, saved.left, saved.top);
      return;
    }
  } catch (_error) {
    // Invalid client data falls back to the safe default.
  }
  applyDefaultButtonPosition(button);
}

function setButtonPosition(button, left, top) {
  const maxLeft = Math.max(0, window.innerWidth - button.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - button.offsetHeight);
  button.style.left = `${Math.min(maxLeft, Math.max(0, left))}px`;
  button.style.top = `${Math.min(maxTop, Math.max(0, top))}px`;
  button.style.bottom = "auto";
}

function clampButtonPosition(button) {
  const rect = button.getBoundingClientRect();
  setButtonPosition(button, rect.left, rect.top);
}

function saveButtonPosition(button) {
  const rect = button.getBoundingClientRect();
  localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
}

function openDashboard() {
  const dashboardWindow = window.open(
    getDashboardUrl(),
    "combat-wall-dashboard",
    "popup=yes,width=1600,height=900,resizable=yes,scrollbars=no"
  );

  if (!dashboardWindow) {
    ui.notifications?.warn("Das Dashboard wurde vom Popup-Blocker verhindert.");
    return;
  }

  dashboardWindow.focus();
  window.setTimeout(() => scheduleBroadcast("dashboard-opened", 0, true), 350);
}

function getDashboardUrl() {
  const route = foundry.utils.getRoute(`modules/${MODULE_ID}/dashboard/index.html`);
  const url = new URL(route, window.location.origin);
  url.searchParams.set("world", game.world?.id ?? "unknown-world");
  url.searchParams.set("title", game.world?.title ?? "Foundry-Welt");
  return url.href;
}

function scheduleBroadcast(reason = "update", delay = UPDATE_DEBOUNCE_MS, force = false) {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(() => broadcastState(reason, force), delay);
}

function scheduleCombatRefresh(reason = "update", delay = GROUP_SYNC_DEBOUNCE_MS, force = false) {
  window.clearTimeout(groupSyncTimer);
  groupSyncTimer = window.setTimeout(async () => {
    await synchronizeNpcGroups(game.combat);
    scheduleBroadcast(reason, 0, force);
  }, delay);
}

function scheduleCombatRefreshWithInitiatives(reason, preferredInitiatives) {
  window.clearTimeout(groupSyncTimer);
  groupSyncTimer = window.setTimeout(async () => {
    await synchronizeNpcGroups(game.combat, preferredInitiatives);
    scheduleBroadcast(reason, 0);
  }, GROUP_SYNC_DEBOUNCE_MS);
}

async function synchronizeNpcGroups(combat, preferredInitiatives = new Map()) {
  if (!combat || groupSyncRunning || !game.user?.isGM) return;
  const combatSceneId = combat.scene?.id ?? combat.scene ?? null;
  const currentSceneId = globalThis.canvas?.scene?.id ?? game.scenes?.current?.id ?? null;
  if (combatSceneId && currentSceneId && combatSceneId !== currentSceneId) return;
  groupSyncRunning = true;

  try {
    const combatants = Array.from(combat.combatants?.contents ?? []);
    const npcBuckets = new Map();

    for (const combatant of combatants) {
      if (combatant.hidden) continue;
      if (classifyCombatant(combatant, combatant.actor, combatant.token) !== "npc") continue;
      const groupId = resolveCombatantGroupId(combatant);
      if (!groupId) continue;
      if (!npcBuckets.has(groupId)) npcBuckets.set(groupId, []);
      npcBuckets.get(groupId).push(combatant);
    }

    const managedGroups = Array.from(combat.groups?.contents ?? [])
      .filter((group) => group.getFlag?.(MODULE_ID, "managed"));
    const managedByKey = new Map(
      managedGroups.map((group) => [group.getFlag(MODULE_ID, "groupId"), group])
    );

    const missingGroups = [];
    for (const [groupId, members] of npcBuckets) {
      if (members.length < 2) continue;
      if (managedByKey.has(groupId)) continue;
      const representative = members[0];
      missingGroups.push({
        type: "base",
        name: resolveGroupName(representative, representative.actor),
        img: representative.img ?? representative.actor?.img,
        initiative: preferredInitiatives.get(groupId) ?? firstInitiative(members),
        flags: {
          [MODULE_ID]: {
            managed: true,
            groupId
          }
        }
      });
    }

    if (missingGroups.length) {
      const created = await combat.createEmbeddedDocuments("CombatantGroup", missingGroups, {
        combatWallGroupSync: true
      });
      for (const group of created) {
        managedByKey.set(group.getFlag(MODULE_ID, "groupId"), group);
      }
    }

    const groupUpdates = [];
    const combatantUpdates = [];
    for (const [groupId, members] of npcBuckets) {
      if (members.length < 2) continue;
      const group = managedByKey.get(groupId);
      if (!group) continue;

      const sharedInitiative =
        preferredInitiatives.get(groupId) ??
        numberOrNull(group.initiative) ??
        firstInitiative(members);
      if (sharedInitiative !== null && numberOrNull(group.initiative) !== sharedInitiative) {
        groupUpdates.push({ _id: group.id, initiative: sharedInitiative });
      }

      for (const member of members) {
        const currentGroupId = member.group?.id ?? member.group ?? null;
        const update = { _id: member.id };
        let changed = false;
        if (currentGroupId !== group.id) {
          update.group = group.id;
          changed = true;
        }
        if (
          sharedInitiative !== null &&
          numberOrNull(member.initiative) !== sharedInitiative
        ) {
          update.initiative = sharedInitiative;
          changed = true;
        }
        if (changed) combatantUpdates.push(update);
      }
    }

    for (const group of managedGroups) {
      const groupId = group.getFlag(MODULE_ID, "groupId");
      if (!npcBuckets.has(groupId) || npcBuckets.get(groupId).length < 2) {
        await combat.deleteEmbeddedDocuments("CombatantGroup", [group.id], {
          combatWallGroupSync: true
        });
      }
    }

    if (groupUpdates.length) {
      await combat.updateEmbeddedDocuments("CombatantGroup", groupUpdates, {
        combatWallGroupSync: true
      });
    }
    if (combatantUpdates.length) {
      await combat.updateEmbeddedDocuments("Combatant", combatantUpdates, {
        combatWallGroupSync: true
      });
    }

    await ensureStableSegmentOrder(combat, npcBuckets);
  } catch (error) {
    console.error(`${MODULE_TITLE} | Gruppeninitiative konnte nicht synchronisiert werden`, error);
  } finally {
    groupSyncRunning = false;
  }
}

function firstInitiative(combatants) {
  for (const combatant of combatants) {
    const initiative = numberOrNull(combatant.initiative);
    if (initiative !== null) return initiative;
  }
  return null;
}

async function ensureStableSegmentOrder(combat, npcBuckets) {
  const storedOrder = combat.getFlag?.(MODULE_ID, "segmentOrder") ?? {};
  const nextOrder = {};

  for (const [groupId, combatants] of npcBuckets) {
    const validIds = new Set(combatants.map((combatant) => combatant.id));
    const previousIds = Array.isArray(storedOrder[groupId])
      ? storedOrder[groupId].filter((id) => validIds.has(id))
      : [];
    const knownIds = new Set(previousIds);
    const newIds = combatants
      .filter((combatant) => !knownIds.has(combatant.id))
      .sort(compareCombatantsByMapPosition)
      .map((combatant) => combatant.id);
    nextOrder[groupId] = previousIds.concat(newIds);
  }

  if (JSON.stringify(storedOrder) !== JSON.stringify(nextOrder)) {
    await combat.setFlag(MODULE_ID, "segmentOrder", nextOrder);
  }
}

function broadcastState(reason = "update", force = false) {
  if (!channel) return;

  const state = buildDashboardState();
  const signature = JSON.stringify(state, (key, value) => key === "generatedAt" ? undefined : value);
  if (!force && signature === lastStateSignature) return;

  lastStateSignature = signature;
  channel.postMessage({
    type: "combat-state",
    reason,
    sentAt: Date.now(),
    payload: state
  });
}

function buildDashboardState() {
  const combat = game.combat;
  const base = {
    schemaVersion: 5,
    moduleVersion: MODULE_VERSION,
    world: {
      id: game.world?.id ?? null,
      title: game.world?.title ?? "Foundry-Welt"
    },
    combatActive: false,
    round: 0,
    turn: null,
    current: null,
    activeCombatantId: null,
    initiative: [],
    groups: [],
    activeEntityType: null,
    activeDisplayName: null,
    activeFocusImage: null,
    activeFocusImageSource: null,
    focusModeVariant: "focus-player",
    enemySideGroupsLeft: [],
    enemySideGroupsRight: [],
    hiddenOverflowGroupCount: 0,
    generatedAt: Date.now()
  };

  if (!combat) return base;

  const allTurns = Array.from(combat.turns ?? combat.combatants?.contents ?? []);
  const turns = allTurns.filter((combatant) => !combatant.hidden);
  if (!turns.length) {
    return {
      ...base,
      combatActive: Boolean(combat.started),
      round: Number(combat.round ?? 0),
      turn: Number.isInteger(combat.turn) ? combat.turn : null
    };
  }

  const actualCurrentCombatant = combat.combatant ?? allTurns[combat.turn ?? -1] ?? null;
  const currentCombatant = actualCurrentCombatant?.hidden ? null : actualCurrentCombatant;
  const segmentOrder = combat.getFlag?.(MODULE_ID, "segmentOrder") ?? {};
  const members = turns.map((combatant, index) =>
    serializeCombatant(combatant, index, currentCombatant, segmentOrder)
  );
  const npcGroups = buildNpcGroups(members);
  const publicInitiative = buildPublicInitiative(members, npcGroups, currentCombatant?.id ?? null);
  const current = buildCurrentEntry(currentCombatant, members, npcGroups);
  const activeEntityType = current?.kind === "npc" ? "enemy" : current ? "player" : null;
  const sideDistribution = distributeSideGroups(npcGroups, current);

  return {
    ...base,
    combatActive: Boolean(combat.started || Number(combat.round ?? 0) > 0),
    combatId: combat.id,
    round: Number(combat.round ?? 0),
    turn: Number.isInteger(combat.turn) ? combat.turn : null,
    current,
    activeCombatantId: currentCombatant?.id ?? null,
    activeEntityType,
    activeDisplayName: current?.name ?? null,
    activeFocusImage: current?.focusImage ?? current?.image ?? null,
    activeFocusImageSource: current?.focusImageSource ?? null,
    focusModeVariant: activeEntityType === "enemy" ? "focus-enemy" : "focus-player",
    enemySideGroupsLeft: sideDistribution.left.map((group) => group.id),
    enemySideGroupsRight: sideDistribution.right.map((group) => group.id),
    hiddenOverflowGroupCount: 0,
    initiative: publicInitiative,
    groups: npcGroups
  };
}

function serializeCombatant(combatant, turnIndex, currentCombatant, segmentOrder) {
  const actor = combatant.actor ?? null;
  const token = combatant.token ?? null;
  const kind = classifyCombatant(combatant, actor, token);
  const isPlaceholder = kind === "placeholder";
  const isPlayerEntry = kind !== "npc";
  const hpValue = numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.value"));
  const hpMax = numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.max"));
  const defeated = Boolean(combatant.defeated || (hpValue !== null && hpValue <= 0));
  const statusSet = actor?.statuses instanceof Set ? actor.statuses : new Set(actor?.statuses ?? []);
  const activeEffects = serializeActiveEffects(actor);
  const bloodied = resolveBloodiedState(hpValue, hpMax);

  const groupId = kind === "npc" ? resolveGroupId(combatant, actor) : null;
  const groupName = kind === "npc" ? resolveGroupName(combatant, actor) : null;
  const storedPosition = groupId ? segmentOrder[groupId]?.indexOf(combatant.id) ?? -1 : -1;
  const sizeInfo = kind === "npc" ? resolveCreatureSize(actor) : null;
  const markerPosition = kind === "npc" ? resolveMarkerPosition(token) : null;
  const stableMemberIndex = storedPosition >= 0 ? storedPosition : 0;
  const markerColor = kind === "npc" ? markerColorForIndex(stableMemberIndex) : null;

  return {
    id: combatant.id,
    actorId: actor?.id ?? null,
    tokenId: token?.id ?? combatant.tokenId ?? null,
    turnIndex,
    kind,
    isPlaceholder,
    isPlayer: isPlayerEntry,
    name: combatant.name ?? actor?.name ?? "Unbekannt",
    image: absoluteAssetUrl(combatant.img ?? token?.texture?.src ?? actor?.img),
    initiative: numberOrNull(combatant.initiative),
    groupId,
    groupName,
    groupPosition: storedPosition >= 0 ? storedPosition + 1 : null,
    active: combatant.id === currentCombatant?.id,
    defeated,
    hidden: Boolean(combatant.hidden),
    statuses: Array.from(statusSet).map(String).sort(),
    activeEffects,
    translatedEffects: activeEffects.map((effect) => effect.label),
    effectDuration: activeEffects.map((effect) => effect.durationLabel).filter(Boolean),
    isBloodied: bloodied.isBloodied,
    bloodiedThreshold: bloodied.threshold,
    groupMemberBloodiedState: bloodied.isBloodied,
    hp: {
      value: hpValue,
      max: hpMax
    },
    position: {
      x: numberOrNull(token?.x),
      y: numberOrNull(token?.y),
      elevation: numberOrNull(token?.elevation)
    },
    size: sizeInfo?.size ?? null,
    creatureSize: sizeInfo?.size ?? null,
    sizeSource: sizeInfo?.source ?? null,
    actorSizeRaw: sizeInfo?.raw ?? null,
    layoutWeight: sizeInfo ? SIZE_WEIGHTS[sizeInfo.size] : null,
    stableMemberIndex,
    markerColor,
    normalizedX: markerPosition?.normalizedX ?? null,
    normalizedY: markerPosition?.normalizedY ?? null,
    markerVisible: Boolean(markerPosition && !combatant.hidden),
    markerActive: combatant.id === currentCombatant?.id,
    markerDefeated: defeated,
    markerSource: markerPosition?.source ?? "unavailable"
  };
}

function classifyCombatant(combatant, actor, token) {
  const explicitType = combatant.getFlag?.(MODULE_ID, "entryType");
  if (explicitType === "player" || explicitType === "placeholder") return "placeholder";

  if (actor?.hasPlayerOwner || actor?.type === "character") return "player";

  const currentSceneId = globalThis.canvas?.scene?.id ?? game.scenes?.current?.id ?? null;
  const tokenSceneId = token?.parent?.id ?? token?.scene?.id ?? null;
  const isNpcActor = Boolean(actor && actor.type === "npc");
  const hasCurrentSceneToken = Boolean(
    token?.id &&
    token?.parent?.documentName === "Scene" &&
    currentSceneId &&
    tokenSceneId === currentSceneId
  );

  // Flags may identify an entry's intent, but they must never promote a
  // placeholder or an off-scene combatant into an enemy tile.
  if (isNpcActor && hasCurrentSceneToken) return "npc";
  return "placeholder";
}

const EFFECT_TRANSLATIONS = Object.freeze({
  poisoned: "Vergiftet",
  frightened: "Verängstigt",
  restrained: "Festgehalten",
  stunned: "Betäubt",
  paralyzed: "Gelähmt",
  prone: "Liegend",
  grappled: "Gepackt",
  unconscious: "Bewusstlos",
  blinded: "Blind",
  charmed: "Bezaubert",
  incapacitated: "Handlungsunfähig",
  invisible: "Unsichtbar",
  deafened: "Taub",
  exhaustion: "Erschöpfung",
  petrified: "Versteinert"
});

function translateEffectName(effect) {
  const statusId = Array.from(effect?.statuses ?? [])[0];
  const key = String(statusId ?? effect?.name ?? effect?.label ?? "").trim().toLowerCase();
  return EFFECT_TRANSLATIONS[key] ?? String(effect?.name ?? effect?.label ?? statusId ?? "Unbekannter Zustand");
}

function formatEffectDuration(effect) {
  const duration = effect?.duration ?? {};
  const remainingRounds = numberOrNull(duration.remaining);
  if (remainingRounds !== null && remainingRounds > 0 && duration.rounds != null) {
    const rounded = Math.max(1, Math.ceil(remainingRounds));
    return `${rounded} ${rounded === 1 ? "Runde" : "Runden"}`;
  }
  const rounds = numberOrNull(duration.rounds);
  if (rounds !== null && rounds > 0) {
    const rounded = Math.max(1, Math.ceil(rounds));
    return `${rounded} ${rounded === 1 ? "Runde" : "Runden"}`;
  }
  const turns = numberOrNull(duration.turns);
  if (turns !== null && turns > 0) {
    const rounded = Math.max(1, Math.ceil(turns));
    return `${rounded} ${rounded === 1 ? "Zug" : "Züge"}`;
  }
  return null;
}

function serializeActiveEffects(actor) {
  const effects = Array.from(actor?.effects?.contents ?? actor?.effects ?? []);
  return effects
    .filter((effect) => !effect?.disabled && !effect?.isSuppressed)
    .map((effect, index) => ({
      id: effect?.id ?? `effect-${index}`,
      originalName: String(effect?.name ?? effect?.label ?? Array.from(effect?.statuses ?? [])[0] ?? "Unbekannter Zustand"),
      label: translateEffectName(effect),
      icon: absoluteAssetUrl(effect?.img ?? effect?.icon),
      durationLabel: formatEffectDuration(effect)
    }));
}

function resolveBloodiedState(hpValue, hpMax) {
  const valid = Number.isFinite(hpValue) && Number.isFinite(hpMax) && hpMax > 0;
  const threshold = valid ? hpMax / 2 : null;
  return {
    isBloodied: Boolean(valid && hpValue > 0 && hpValue <= threshold),
    threshold
  };
}

function inspectCombatants() {
  const combatants = Array.from(game.combat?.combatants?.contents ?? []);
  const segmentOrder = game.combat?.getFlag?.(MODULE_ID, "segmentOrder") ?? {};
  const rows = combatants.map((combatant, turnIndex) => {
    const actor = combatant.actor ?? null;
    const token = combatant.token ?? null;
    const parent = token?.parent ?? null;
    const kind = classifyCombatant(combatant, actor, token);
    const groupId = kind === "npc" ? resolveGroupId(combatant, actor) : null;
    const storedPosition = groupId ? segmentOrder[groupId]?.indexOf(combatant.id) ?? -1 : -1;
    const sizeInfo = kind === "npc" ? resolveCreatureSize(actor) : null;
    const marker = kind === "npc"
      ? buildMarkerRecord(combatant, groupId, storedPosition >= 0 ? storedPosition : 0)
      : null;
    return {
      Name: combatant.name ?? actor?.name ?? "Unbekannt",
      "Erkannte Art": kind,
      "Actor-Typ": actor?.type ?? null,
      "Actor-ID": combatant.actorId ?? actor?.id ?? null,
      "Token-ID": combatant.tokenId ?? token?.id ?? null,
      "Parent-Dokument": parent?.documentName ?? null,
      "Scene-ID": parent?.documentName === "Scene" ? parent.id : token?.scene?.id ?? null,
      Tokenposition: token ? `${numberOrNull(token.x)}, ${numberOrNull(token.y)}` : null,
      groupId,
      groupPosition: storedPosition >= 0 ? storedPosition + 1 : null,
      creatureSize: sizeInfo?.size ?? null,
      actorSizeRaw: sizeInfo?.raw ?? null,
      sizeSource: sizeInfo?.source ?? null,
      layoutWeight: sizeInfo ? SIZE_WEIGHTS[sizeInfo.size] : null,
      layoutMode: game.combat?.combatant && classifyCombatant(
        game.combat.combatant,
        game.combat.combatant.actor,
        game.combat.combatant.token
      ) === "npc" ? "focus" : "overview",
      markerColor: marker?.color ?? null,
      normalizedX: marker?.normalizedX ?? null,
      normalizedY: marker?.normalizedY ?? null,
      markerVisible: marker?.isVisible ?? false,
      stableMemberIndex: marker?.memberIndex ?? null,
      activeCombatantId: game.combat?.combatant?.id ?? null,
      activeGroupId: game.combat?.combatant
        ? resolveCombatantGroupId(game.combat.combatant)
        : null,
      activeTokenId: game.combat?.combatant?.token?.id ?? game.combat?.combatant?.tokenId ?? null,
      turnIndex
      ,
      activeEffects: serializeActiveEffects(actor).map((effect) => effect.originalName),
      translatedEffects: serializeActiveEffects(actor).map((effect) => effect.label),
      effectDuration: serializeActiveEffects(actor).map((effect) => effect.durationLabel).filter(Boolean),
      isBloodied: resolveBloodiedState(
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.value")),
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.max"))
      ).isBloodied,
      bloodiedThreshold: resolveBloodiedState(
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.value")),
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.max"))
      ).threshold,
      groupMemberBloodiedState: resolveBloodiedState(
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.value")),
        numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.max"))
      ).isBloodied
    };
  });
  console.table(rows);
  return rows;
}

function inspectPublicInitiative() {
  const state = buildDashboardState();
  const rows = state.initiative.map((entry, publicIndex) => ({
    publicIndex,
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    groupId: entry.groupId ?? null,
    totalMembers: entry.totalMembers ?? 1,
    activeMembers: entry.activeMembers ?? (entry.defeated ? 0 : 1),
    actionableMembers: entry.actionableMembers ?? (entry.defeated ? 0 : 1),
    activeGroupPosition: entry.activeGroupPosition ?? null,
    activeGroupCount: entry.activeGroupCount ?? null,
    combatTurnIndex: entry.combatTurnIndex ?? null,
    activeCombatantId: entry.activeCombatantId ?? null,
    orderedGroupMemberIds: entry.orderedGroupMemberIds ?? [],
    actionableGroupMemberIds: entry.actionableGroupMemberIds ?? [],
    initiativeValue: entry.initiativeValue ?? entry.initiative ?? null,
    tieBreakOrder: entry.tieBreakOrder ?? [],
    active: entry.active,
    underlyingCombatantIds: entry.combatantIds ?? [entry.combatantId].filter(Boolean)
  }));
  console.table(rows);
  return rows;
}

function resolveGroupId(combatant, actor) {
  const explicit =
    combatant.getFlag?.(MODULE_ID, "groupId") ||
    actor?.getFlag?.(MODULE_ID, "groupId");

  if (explicit) return slugify(String(explicit));
  if (combatant.actorId) return `actor-${combatant.actorId}`;
  if (actor?.id) return `actor-${actor.id}`;
  return `name-${slugify(stripNumberSuffix(combatant.name ?? actor?.name ?? "gegner"))}`;
}

function resolveCombatantGroupId(combatant) {
  if (classifyCombatant(combatant, combatant.actor, combatant.token) !== "npc") return null;
  return resolveGroupId(combatant, combatant.actor);
}

function resolveGroupName(combatant, actor) {
  const explicit =
    combatant.getFlag?.(MODULE_ID, "groupName") ||
    actor?.getFlag?.(MODULE_ID, "groupName");

  if (explicit) return String(explicit);
  return actor?.name ?? stripNumberSuffix(combatant.name ?? "Gegner");
}

function buildNpcGroups(members) {
  const groups = new Map();

  for (const member of members) {
    if (member.kind !== "npc") continue;

    if (!groups.has(member.groupId)) {
      groups.set(member.groupId, {
        id: member.groupId,
        name: member.groupName,
        image: member.image,
        initiative: member.initiative,
        total: 0,
        living: 0,
        defeated: 0,
        actionableMembers: 0,
        activeCombatantId: null,
        activeGroupPosition: null,
        activeGroupCount: 0,
        activeMember: null,
        size: member.creatureSize ?? member.size,
        creatureSize: member.creatureSize ?? member.size,
        actorSizeRaw: member.actorSizeRaw ?? null,
        sizeSource: member.sizeSource ?? "fallback",
        layoutWeight: member.layoutWeight ?? 1,
        mainEnemy: false,
        layoutMultiplier: 1,
        members: []
      });
    }

    const group = groups.get(member.groupId);
    group.total += 1;
    group.defeated += member.defeated ? 1 : 0;
    group.living += member.defeated ? 0 : 1;
    group.actionableMembers += member.defeated ? 0 : 1;
    group.initiative = group.initiative ?? member.initiative;
    group.members.push(member);
  }

  return Array.from(groups.values())
    .map((group) => {
      group.members.sort(compareMembersByFoundryTurn);
      const actionable = group.members.filter((member) => !member.defeated);
      const activeMember = group.members.find((member) => member.active) ?? null;
      const activeIndex = activeMember
        ? actionable.findIndex((member) => member.id === activeMember.id)
        : -1;
      group.activeMember = activeIndex >= 0 ? activeIndex + 1 : null;
      group.activeCombatantId = activeMember?.id ?? null;
      group.activeGroupPosition = group.activeMember;
      group.activeGroupCount = actionable.length;
      group.totalMembers = group.total;
      group.activeMembers = group.living;
      group.combatantIds = group.members.map((member) => member.id);
      group.orderedGroupMemberIds = group.members.map((member) => member.id);
      group.actionableGroupMemberIds = actionable.map((member) => member.id);
      group.combatTurnIndex = activeMember?.turnIndex ?? null;
      group.initiativeValue = activeMember?.initiative ?? group.initiative;
      group.tieBreakOrder = group.members.map((member) => member.turnIndex);
      group.allDefeated = group.total > 0 && group.defeated === group.total;
      group.effectiveLayoutWeight = clamp(
        group.layoutWeight * group.layoutMultiplier,
        0.65,
        2.3
      );
      group.groupMarkers = group.members
        .filter((member) => member.markerVisible)
        .map(markerFromMember)
        .sort((a, b) => a.memberIndex - b.memberIndex);
      return group;
    })
    .sort((a, b) => compareInitiative(a.initiative, b.initiative));
}

function buildPublicInitiative(members, groups, currentCombatantId) {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const seenGroups = new Set();
  const result = [];

  for (const member of members) {
    if (member.kind !== "npc") {
      result.push({
        id: `combatant-${member.id}`,
        combatantId: member.id,
        kind: member.kind,
        name: member.name,
        image: member.image,
        initiative: member.initiative,
        active: member.id === currentCombatantId,
        defeated: member.defeated
      });
      continue;
    }

    if (seenGroups.has(member.groupId)) continue;
    seenGroups.add(member.groupId);

    const group = groupsById.get(member.groupId);
    result.push({
      id: `group-${member.groupId}`,
      kind: "group",
      groupId: member.groupId,
      name: group?.name ?? member.groupName,
      image: group?.image ?? member.image,
      initiative: group?.initiative ?? member.initiative,
      active: Boolean(group?.activeMember),
      defeated: Boolean(group?.allDefeated),
      activeMember: group?.activeMember ?? null,
      memberCount: group?.totalMembers ?? 1,
      totalMembers: group?.totalMembers ?? 1,
      activeMembers: group?.activeMembers ?? 1,
      actionableMembers: group?.actionableMembers ?? 1,
      activeGroupPosition: group?.activeGroupPosition ?? null,
      activeGroupCount: group?.activeGroupCount ?? 1,
      activeCombatantId: group?.activeCombatantId ?? null,
      orderedGroupMemberIds: group?.orderedGroupMemberIds ?? [member.id],
      actionableGroupMemberIds: group?.actionableGroupMemberIds ?? [member.id],
      combatTurnIndex: group?.combatTurnIndex ?? null,
      initiativeValue: group?.initiativeValue ?? member.initiative,
      tieBreakOrder: group?.tieBreakOrder ?? [member.turnIndex],
      combatantIds: group?.combatantIds ?? [member.id]
    });
  }

  return result;
}

function buildCurrentEntry(currentCombatant, members, groups) {
  if (!currentCombatant) return null;
  const member = members.find((entry) => entry.id === currentCombatant.id);
  if (!member) return null;

  if (member.kind !== "npc") {
    const explicitFlag = currentCombatant.getFlag?.(MODULE_ID, "focusImage");
    const mappedImage = getPlayerImageMapping()[normalizedPlayerKey(member.name)];
    const fallbackImage = member.image;
    const focusImage = absoluteAssetUrl(explicitFlag || mappedImage || fallbackImage);
    return {
      id: member.id,
      kind: member.kind,
      name: member.name,
      image: focusImage,
      focusImage,
      focusImageSource: explicitFlag ? "combatant-flag" : mappedImage ? "player-name-mapping" : fallbackImage ? "actor-or-token" : "module-fallback",
      statuses: [],
      defeated: member.defeated
    };
  }

  const group = groups.find((entry) => entry.id === member.groupId);
  return {
    id: member.id,
    kind: "npc",
    name: member.name,
    image: member.image,
    focusImage: member.image,
    focusImageSource: "active-combatant",
    tokenId: member.tokenId,
    groupId: member.groupId,
    groupName: member.groupName,
    groupPosition: group?.activeGroupPosition ?? null,
    groupSize: group?.activeGroupCount ?? 1,
    totalMembers: group?.totalMembers ?? 1,
    activeMembers: group?.activeMembers ?? 1,
    actionableMembers: group?.actionableMembers ?? 1,
    activeGroupPosition: group?.activeGroupPosition ?? null,
    activeGroupCount: group?.activeGroupCount ?? 1,
    activeCombatantId: member.id,
    statuses: member.statuses,
    activeEffects: member.activeEffects,
    translatedEffects: member.translatedEffects,
    effectDuration: member.effectDuration,
    isBloodied: member.isBloodied,
    bloodiedThreshold: member.bloodiedThreshold,
    groupMemberBloodiedState: member.groupMemberBloodiedState,
    defeated: member.defeated,
    markerColor: member.markerColor,
    normalizedX: member.normalizedX,
    normalizedY: member.normalizedY,
    markerVisible: member.markerVisible,
    markerActive: member.markerActive,
    markerDefeated: member.markerDefeated,
    markerSource: member.markerSource,
    stableMemberIndex: member.stableMemberIndex,
    groupMarkers: group?.groupMarkers ?? []
  };
}

function distributeSideGroups(groups, current) {
  const activeGroupId = current?.kind === "npc" ? current.groupId : null;
  const candidates = groups
    .filter((group) => group.id !== activeGroupId)
    .sort((a, b) => (b.effectiveLayoutWeight ?? 1) - (a.effectiveLayoutWeight ?? 1));
  const left = [];
  const right = [];
  let leftWeight = 0;
  let rightWeight = 0;
  for (const group of candidates) {
    const weight = group.effectiveLayoutWeight ?? 1;
    if (leftWeight <= rightWeight) {
      left.push(group);
      leftWeight += weight;
    } else {
      right.push(group);
      rightWeight += weight;
    }
  }
  return { left, right };
}

function compareMembersByStablePosition(a, b) {
  const left = a.groupPosition ?? Number.MAX_SAFE_INTEGER;
  const right = b.groupPosition ?? Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
  return a.turnIndex - b.turnIndex;
}

function compareMembersByFoundryTurn(a, b) {
  return a.turnIndex - b.turnIndex;
}

function compareCombatantsByMapPosition(a, b) {
  const ay = numberOrNull(a.token?.y) ?? Number.MAX_SAFE_INTEGER;
  const by = numberOrNull(b.token?.y) ?? Number.MAX_SAFE_INTEGER;
  const ax = numberOrNull(a.token?.x) ?? Number.MAX_SAFE_INTEGER;
  const bx = numberOrNull(b.token?.x) ?? Number.MAX_SAFE_INTEGER;

  const rowTolerance = 50;
  if (Math.abs(ay - by) > rowTolerance) return ay - by;
  if (ax !== bx) return ax - bx;
  return String(a.id).localeCompare(String(b.id));
}

function resolveCreatureSize(actor) {
  const candidates = [
    ["system.traits.size", foundry.utils.getProperty(actor, "system.traits.size")],
    ["system.details.size", foundry.utils.getProperty(actor, "system.details.size")],
    ["system.attributes.size", foundry.utils.getProperty(actor, "system.attributes.size")]
  ];
  const aliases = {
    tiny: "tiny",
    sm: "small",
    small: "small",
    med: "medium",
    medium: "medium",
    lg: "large",
    large: "large",
    huge: "huge",
    grg: "gargantuan",
    gargantuan: "gargantuan"
  };

  for (const [path, candidate] of candidates) {
    const raw = candidate?.value ?? candidate;
    const normalized = aliases[String(raw ?? "").trim().toLowerCase()];
    if (normalized) return { size: normalized, source: path, raw };
  }
  return { size: "medium", source: "fallback", raw: null };
}

function resolveMarkerPosition(token) {
  const scene = token?.parent?.documentName === "Scene" ? token.parent : null;
  if (!scene) return null;

  const dimensions = scene.dimensions ?? scene.getDimensions?.();
  const sceneRect = dimensions?.sceneRect ?? globalThis.canvas?.dimensions?.sceneRect ?? null;
  const sceneWidth = numberOrNull(sceneRect?.width)
    ?? numberOrNull(dimensions?.sceneWidth)
    ?? numberOrNull(scene.width);
  const sceneHeight = numberOrNull(sceneRect?.height)
    ?? numberOrNull(dimensions?.sceneHeight)
    ?? numberOrNull(scene.height);
  const sceneX = numberOrNull(sceneRect?.x) ?? numberOrNull(dimensions?.sceneX) ?? 0;
  const sceneY = numberOrNull(sceneRect?.y) ?? numberOrNull(dimensions?.sceneY) ?? 0;
  const gridSize = numberOrNull(dimensions?.size) ?? numberOrNull(scene.grid?.size) ?? 1;
  if (!sceneWidth || !sceneHeight) return null;

  const tokenCenterX = (numberOrNull(token.x) ?? 0) + (numberOrNull(token.width) ?? 1) * gridSize / 2;
  const tokenCenterY = (numberOrNull(token.y) ?? 0) + (numberOrNull(token.height) ?? 1) * gridSize / 2;
  return {
    normalizedX: clamp((tokenCenterX - sceneX) / sceneWidth, MARKER_EDGE_PERCENT / 100, 1 - MARKER_EDGE_PERCENT / 100),
    normalizedY: clamp((tokenCenterY - sceneY) / sceneHeight, MARKER_EDGE_PERCENT / 100, 1 - MARKER_EDGE_PERCENT / 100),
    source: sceneRect ? "sceneRect" : "sceneDimensions"
  };
}

function markerColorForIndex(index) {
  return MARKER_COLORS[Math.max(0, Number(index) || 0) % MARKER_COLORS.length];
}

function markerFromMember(member) {
  return {
    combatantId: member.id,
    groupId: member.groupId,
    memberIndex: member.stableMemberIndex,
    color: member.markerColor,
    normalizedX: member.normalizedX,
    normalizedY: member.normalizedY,
    isActive: Boolean(member.markerActive),
    isDefeated: Boolean(member.markerDefeated),
    isHidden: Boolean(member.hidden),
    isVisible: Boolean(member.markerVisible)
    ,
    isBloodied: Boolean(member.isBloodied),
    bloodiedThreshold: member.bloodiedThreshold
  };
}

function buildMarkerRecord(combatant, groupId, stableMemberIndex) {
  if (!combatant || !groupId) return null;
  const markerPosition = resolveMarkerPosition(combatant.token);
  const hidden = Boolean(combatant.hidden);
  return {
    combatantId: combatant.id,
    groupId,
    memberIndex: stableMemberIndex,
    color: markerColorForIndex(stableMemberIndex),
    normalizedX: markerPosition?.normalizedX ?? null,
    normalizedY: markerPosition?.normalizedY ?? null,
    isActive: combatant.id === game.combat?.combatant?.id,
    isDefeated: Boolean(combatant.isDefeated ?? combatant.defeated),
    isHidden: hidden,
    isVisible: Boolean(markerPosition && !hidden)
  };
}

function getMarkerData(combatantId) {
  try {
    const group = buildDashboardState().groups.find((entry) =>
      entry.members.some((member) => member.id === combatantId)
    );
    const marker = group?.groupMarkers?.find((entry) => entry.combatantId === combatantId);
    return marker ? { ...marker } : null;
  } catch (_error) {
    return null;
  }
}

function getGroupMarkerData(groupId) {
  try {
    const markers = buildDashboardState().groups
      .find((group) => group.id === groupId)?.groupMarkers;
    return Array.isArray(markers) ? markers.map((marker) => ({ ...marker })) : [];
  } catch (_error) {
    return [];
  }
}

function inspectMarkers() {
  const state = buildDashboardState();
  const focusGroupId = state.current?.kind === "npc" ? state.current.groupId : null;
  const rows = state.groups.flatMap((group) => group.members.map((member) => ({
    name: member.name,
    combatantId: member.id,
    groupId: group.id,
    stableMemberIndex: member.stableMemberIndex,
    color: member.markerColor,
    tokenX: member.position?.x ?? null,
    tokenY: member.position?.y ?? null,
    normalizedX: member.normalizedX,
    normalizedY: member.normalizedY,
    active: member.markerActive,
    defeated: member.markerDefeated,
    hidden: member.hidden,
    visible: member.markerVisible,
    activeEffects: member.activeEffects?.map((effect) => effect.originalName) ?? [],
    translatedEffects: member.translatedEffects ?? [],
    effectDuration: member.effectDuration ?? [],
    isBloodied: Boolean(member.isBloodied),
    bloodiedThreshold: member.bloodiedThreshold ?? null,
    groupMemberBloodiedState: Boolean(member.groupMemberBloodiedState),
    renderedInFocus: group.id === focusGroupId,
    renderedInSideCard: group.id !== focusGroupId
  })));
  console.table(rows);
  return rows;
}

function compareInitiative(a, b) {
  const left = a ?? -Infinity;
  const right = b ?? -Infinity;
  return right - left;
}

function stripNumberSuffix(value) {
  return String(value ?? "")
    .replace(/\s*[#-]?\d+\s*$/u, "")
    .replace(/\s*\(\d+\)\s*$/u, "")
    .trim();
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "gruppe";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function absoluteAssetUrl(path) {
  const fallbackRoute = foundry.utils.getRoute(`modules/${MODULE_ID}/assets/fallback.svg`);
  if (!path) return new URL(fallbackRoute, window.location.origin).href;

  const value = String(path);
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const cleanPath = value.replace(/^\/+/, "");
  const route = foundry.utils.getRoute(cleanPath);
  return new URL(route, window.location.origin).href;
}
