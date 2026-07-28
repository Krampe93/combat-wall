const MODULE_ID = "combat-wall";
const MODULE_TITLE = "Combat Wall";
const MODULE_VERSION = "0.5.2";
const CHANNEL_PREFIX = "combat-wall";
const UPDATE_DEBOUNCE_MS = 80;
const GROUP_SYNC_DEBOUNCE_MS = 160;
const CENTER_TARGET_THRESHOLD = 0.035;
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
    inspectCombatants
  };
}

function installDashboardButton() {
  if (document.getElementById("combat-wall-open")) return;

  const button = document.createElement("button");
  button.id = "combat-wall-open";
  button.type = "button";
  button.title = "Combat Wall auf dem zweiten Bildschirm öffnen";
  button.innerHTML = '<i class="fa-solid fa-display"></i><span>Combat Wall</span>';
  button.addEventListener("click", openDashboard);

  document.body.appendChild(button);
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
        if (currentGroupId !== group.id) {
          combatantUpdates.push({ _id: member.id, group: group.id });
        }
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
    schemaVersion: 3,
    moduleVersion: MODULE_VERSION,
    world: {
      id: game.world?.id ?? null,
      title: game.world?.title ?? "Foundry-Welt"
    },
    combatActive: false,
    round: 0,
    turn: null,
    current: null,
    initiative: [],
    groups: [],
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

  return {
    ...base,
    combatActive: Boolean(combat.started || Number(combat.round ?? 0) > 0),
    combatId: combat.id,
    round: Number(combat.round ?? 0),
    turn: Number.isInteger(combat.turn) ? combat.turn : null,
    current,
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

  const groupId = kind === "npc" ? resolveGroupId(combatant, actor) : null;
  const groupName = kind === "npc" ? resolveGroupName(combatant, actor) : null;
  const storedPosition = groupId ? segmentOrder[groupId]?.indexOf(combatant.id) ?? -1 : -1;
  const size = kind === "npc" ? resolveCreatureSize(actor) : null;
  const direction = kind === "npc" ? resolveDirection(token) : null;

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
    hp: {
      value: hpValue,
      max: hpMax
    },
    position: {
      x: numberOrNull(token?.x),
      y: numberOrNull(token?.y),
      elevation: numberOrNull(token?.elevation)
    },
    size,
    layoutWeight: size ? SIZE_WEIGHTS[size] : null,
    directionAngle: direction?.angle ?? null,
    directionState: direction?.state ?? null
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
    const size = kind === "npc" ? resolveCreatureSize(actor) : null;
    const direction = kind === "npc" ? resolveDirection(token) : null;
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
      size,
      layoutWeight: size ? SIZE_WEIGHTS[size] : null,
      directionAngle: direction?.angle ?? null,
      directionState: direction?.state ?? null,
      activeCombatantId: game.combat?.combatant?.id ?? null,
      activeGroupId: game.combat?.combatant
        ? resolveCombatantGroupId(game.combat.combatant)
        : null,
      activeTokenId: game.combat?.combatant?.token?.id ?? game.combat?.combatant?.tokenId ?? null,
      activeDirectionAngle: game.combat?.combatant
        ? resolveDirection(game.combat.combatant.token)?.angle ?? null
        : null,
      turnIndex
    };
  });
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
        activeMember: null,
        size: member.size,
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
    group.initiative = group.initiative ?? member.initiative;
    group.members.push(member);
  }

  return Array.from(groups.values())
    .map((group) => {
      group.members.sort(compareMembersByStablePosition);
      const activeIndex = group.members.findIndex((member) => member.active);
      group.activeMember = activeIndex >= 0 ? activeIndex + 1 : null;
      group.allDefeated = group.total > 0 && group.defeated === group.total;
      group.effectiveLayoutWeight = clamp(
        group.layoutWeight * group.layoutMultiplier,
        0.65,
        2.3
      );
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
      name: group?.name ?? member.groupName,
      image: group?.image ?? member.image,
      initiative: group?.initiative ?? member.initiative,
      active: Boolean(group?.activeMember),
      defeated: Boolean(group?.allDefeated),
      activeMember: group?.activeMember ?? null,
      memberCount: group?.total ?? 1
    });
  }

  return result;
}

function buildCurrentEntry(currentCombatant, members, groups) {
  if (!currentCombatant) return null;
  const member = members.find((entry) => entry.id === currentCombatant.id);
  if (!member) return null;

  if (member.kind !== "npc") {
    return {
      id: member.id,
      kind: member.kind,
      name: member.name,
      image: member.image,
      statuses: member.statuses,
      defeated: member.defeated
    };
  }

  const group = groups.find((entry) => entry.id === member.groupId);
  return {
    id: member.id,
    kind: "npc",
    name: member.name,
    image: member.image,
    tokenId: member.tokenId,
    groupId: member.groupId,
    groupName: member.groupName,
    groupPosition: group?.activeMember ?? null,
    groupSize: group?.total ?? 1,
    statuses: member.statuses,
    defeated: member.defeated,
    directionAngle: member.directionAngle,
    directionState: member.directionState
  };
}

function compareMembersByStablePosition(a, b) {
  const left = a.groupPosition ?? Number.MAX_SAFE_INTEGER;
  const right = b.groupPosition ?? Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
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
  const rawSize = foundry.utils.getProperty(actor, "system.traits.size");
  const size = String(rawSize ?? "medium").toLowerCase();
  return Object.hasOwn(SIZE_WEIGHTS, size) ? size : "medium";
}

function resolveDirection(token) {
  const scene = token?.parent?.documentName === "Scene" ? token.parent : null;
  if (!scene) return { angle: null, state: "unavailable" };

  const dimensions = scene.dimensions ?? scene.getDimensions?.();
  const sceneWidth = numberOrNull(dimensions?.sceneWidth) ?? numberOrNull(scene.width);
  const sceneHeight = numberOrNull(dimensions?.sceneHeight) ?? numberOrNull(scene.height);
  const sceneX = numberOrNull(dimensions?.sceneX) ?? 0;
  const sceneY = numberOrNull(dimensions?.sceneY) ?? 0;
  const gridSize = numberOrNull(dimensions?.size) ?? numberOrNull(scene.grid?.size) ?? 1;
  if (!sceneWidth || !sceneHeight) return { angle: null, state: "unavailable" };

  const sceneCenterX = sceneX + sceneWidth / 2;
  const sceneCenterY = sceneY + sceneHeight / 2;
  const tokenCenterX = (numberOrNull(token.x) ?? 0) + (numberOrNull(token.width) ?? 1) * gridSize / 2;
  const tokenCenterY = (numberOrNull(token.y) ?? 0) + (numberOrNull(token.height) ?? 1) * gridSize / 2;
  const deltaX = tokenCenterX - sceneCenterX;
  const deltaY = tokenCenterY - sceneCenterY;
  const distance = Math.hypot(deltaX, deltaY);
  const threshold = Math.min(sceneWidth, sceneHeight) * CENTER_TARGET_THRESHOLD;

  if (distance <= threshold) return { angle: null, state: "center" };
  return {
    angle: Math.round(Math.atan2(deltaY, deltaX) * 1800 / Math.PI) / 10,
    state: "direction"
  };
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
