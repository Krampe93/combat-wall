const MODULE_ID = "combat-wall";
const MODULE_TITLE = "Combat Wall";
const MODULE_VERSION = "0.2.0";
const CHANNEL_PREFIX = "combat-wall";
const UPDATE_DEBOUNCE_MS = 80;

let channel = null;
let updateTimer = null;
let lastStateSignature = "";

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initialisiert`);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;

  initializeChannel();
  installDashboardButton();
  registerUpdateHooks();
  exposeDebugApi();
  scheduleBroadcast("ready", 0, true);

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
    "updateCombatant",
    "deleteCombatant",
    "updateActor",
    "createActiveEffect",
    "updateActiveEffect",
    "deleteActiveEffect",
    "updateToken",
    "canvasReady"
  ];

  for (const hookName of hookNames) {
    Hooks.on(hookName, () => scheduleBroadcast(hookName));
  }
}

function exposeDebugApi() {
  window.CombatWall = {
    openDashboard,
    getState: buildDashboardState,
    broadcast: () => broadcastState("manual", true),
    getDashboardUrl
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

function broadcastState(reason = "update", force = false) {
  if (!channel) return;

  const state = buildDashboardState();
  const signature = JSON.stringify(state);
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
    schemaVersion: 2,
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
  const members = turns.map((combatant, index) => serializeCombatant(combatant, index, currentCombatant));
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

function serializeCombatant(combatant, turnIndex, currentCombatant) {
  const actor = combatant.actor ?? null;
  const token = combatant.token ?? null;
  const isPlaceholder = !actor && !token && !combatant.actorId && !combatant.tokenId;
  const isPlayerEntry = Boolean(isPlaceholder || actor?.hasPlayerOwner || actor?.type === "character");
  const kind = isPlaceholder ? "placeholder" : isPlayerEntry ? "player" : "npc";
  const hpValue = numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.value"));
  const hpMax = numberOrNull(foundry.utils.getProperty(actor, "system.attributes.hp.max"));
  const defeated = Boolean(combatant.defeated || (hpValue !== null && hpValue <= 0));
  const statusSet = actor?.statuses instanceof Set ? actor.statuses : new Set(actor?.statuses ?? []);

  const groupId = kind === "npc" ? resolveGroupId(combatant, actor) : null;
  const groupName = kind === "npc" ? resolveGroupName(combatant, actor) : null;

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
    }
  };
}

function resolveGroupId(combatant, actor) {
  const explicit =
    combatant.getFlag?.(MODULE_ID, "groupId") ||
    actor?.getFlag?.(MODULE_ID, "groupId");

  if (explicit) return slugify(String(explicit));
  if (actor?.id) return `actor-${actor.id}`;
  return `name-${slugify(stripNumberSuffix(combatant.name ?? actor?.name ?? "gegner"))}`;
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
      group.members.sort(compareMembersByMapPosition);
      const activeIndex = group.members.findIndex((member) => member.active);
      group.activeMember = activeIndex >= 0 ? activeIndex + 1 : null;
      group.allDefeated = group.total > 0 && group.defeated === group.total;
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
    groupId: member.groupId,
    groupName: member.groupName,
    groupPosition: group?.activeMember ?? null,
    groupSize: group?.total ?? 1,
    statuses: member.statuses,
    defeated: member.defeated
  };
}

function compareMembersByMapPosition(a, b) {
  const ay = a.position?.y ?? Number.MAX_SAFE_INTEGER;
  const by = b.position?.y ?? Number.MAX_SAFE_INTEGER;
  const ax = a.position?.x ?? Number.MAX_SAFE_INTEGER;
  const bx = b.position?.x ?? Number.MAX_SAFE_INTEGER;

  const rowTolerance = 50;
  if (Math.abs(ay - by) > rowTolerance) return ay - by;
  if (ax !== bx) return ax - bx;
  return a.turnIndex - b.turnIndex;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
