const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../scripts/main-1.1.2.js"), "utf8");

function arena({ showHiddenEnemies, tokenHidden = false, combatantHidden = false, playerHidden = false,
  playerName = "Zane", started = true, images = {}, secondEnemy = false } = {}) {
  const scene = { id: "arena", documentName: "Scene", dimensions: {
    sceneRect: { x: 0, y: 0, width: 1000, height: 600 }, size: 100
  } };
  const zane = { id: "zane-actor", uuid: "Actor.zane", name: playerName, type: "character", hasPlayerOwner: true,
    statuses: new Set(["grappled"]), effects: [], system: { attributes: { hp: { value: 20, max: 20 } } } };
  const goblinActor = { id: "goblin-actor", uuid: "Actor.goblin", name: "Goblin", type: "npc", effects: [], statuses: new Set(),
    system: { attributes: { hp: { value: 10, max: 10 } }, traits: { size: "sm" } } };
  const playerFlags = {};
  const player = { id: "player", name: playerName, hidden: playerHidden, initiative: 20,
    img: "icons/svg/mystery-man.svg", getFlag: (_scope, key) => playerFlags[key] };
  const enemy = (id, offset) => ({ id, actor: goblinActor, actorId: goblinActor.id, name: `Goblin ${offset + 1}`, initiative: 15,
    img: "tokens/goblin.png", hidden: combatantHidden,
    token: { id, uuid: `Scene.arena.Token.${id}`, parent: scene, hidden: tokenHidden,
      x: 100 + offset * 300, y: 100, width: 1, height: 1 },
    getFlag: (_scope, key) => key === "groupId" ? "goblins" : undefined });
  const goblin = enemy("goblin-a", 0), goblinB = enemy("goblin-b", 1);
  const turns = [player, goblin, ...(secondEnemy ? [goblinB] : [])];
  const combat = { id: "fight", started, round: started ? 1 : 0, turn: started ? 0 : null,
    combatant: started ? player : null, turns, combatants: { contents: turns }, scene,
    getFlag: (_scope, key) => key === "segmentOrder" ? { goblins: ["goblin-a", "goblin-b"] } : undefined };
  const relation = { statusId: "grappled", label: "Gepackt",
    source: { tokenUuid: goblin.token.uuid, combatantId: goblin.id, combatId: combat.id },
    target: { actorUuid: zane.uuid, combatantId: player.id, combatId: combat.id } };
  zane.effects.push({ id: "grappled", name: "Grappled", statuses: new Set(["grappled"]), duration: { rounds: 3 } });
  const preferences = { showHiddenEnemies, images };
  const registered = new Map();
  const hooks = new Map();
  const game = { user: { isGM: true }, world: { id: "arena" }, combat, actors: new Map([[zane.id, zane]]),
    settings: { get: (_scope, key) => key === "showHiddenEnemies" ? preferences.showHiddenEnemies : preferences.images,
      register: (_scope, key, value) => registered.set(key, value) },
    scenes: { current: scene }, modules: new Map([["gm-combat-workspace", { api: { getConditionRelations: () => [relation] } }]]) };
  const context = vm.createContext({ console, Hooks: { once: (name, callback) => hooks.set(name, callback), on() {} }, game,
    window: { location: { origin: "https://example.invalid" }, clearTimeout() {}, setTimeout() {} },
    globalThis: { canvas: { scene } }, foundry: { utils: {
      getProperty: (object, key) => key.split(".").reduce((value, part) => value?.[part], object),
      getRoute: value => `/foundry/${value}`
    } }, URL, URLSearchParams, BroadcastChannel: class {} });
  vm.runInContext(source, context);
  return { context, game, combat, preferences, registered, hooks, player, playerFlags, goblin, goblinB, goblinActor };
}

function groupFor(state, id) { return state.groups.find(group => group.members.some(member => member.id === id)); }
function portraitUrl(file) { return `https://example.invalid/foundry/modules/combat-wall/assets/portraits/${file}.png`; }

test("hidden enemies option is configurable and enabled by default", () => {
  const value = arena();
  value.hooks.get("init")();
  const setting = value.registered.get("showHiddenEnemies");
  assert.ok(setting, "setting registered with Foundry");
  assert.equal(setting.scope, "world");
  assert.equal(setting.config, true);
  assert.equal(setting.default, true);
  assert.equal(typeof setting.onChange, "function");
});

for (const visibility of [{ tokenHidden: true }, { combatantHidden: true }, { tokenHidden: true, combatantHidden: true }]) {
  test(`shown hidden enemies participate in initiative, markers, conditions and current focus: ${JSON.stringify(visibility)}`, () => {
    const value = arena({ ...visibility, showHiddenEnemies: true, secondEnemy: true });
    const before = value.combat.turns.map(c => [c.hidden, c.token?.hidden]);
    const state = value.context.buildDashboardState();
    const group = groupFor(state, value.goblin.id);
    assert.ok(group);
    assert.equal(group.total, 2);
    assert.equal(group.groupMarkers.length, 2);
    assert.notEqual(group.groupMarkers[0].color, group.groupMarkers[1].color, "hidden members keep distinct stable marker colors");
    assert.ok(state.initiative.some(entry => entry.kind === "group" && entry.memberCount === 2));
    assert.equal(state.current.activeEffects[0].label, "Gepackt von Goblin 1");
    assert.equal(group.members[0].conditionLinks[0].text, "Packt gerade Zane");
    value.combat.combatant = value.goblin; value.combat.turn = 1;
    const enemyTurn = value.context.buildDashboardState();
    assert.equal(enemyTurn.current.id, value.goblin.id);
    assert.equal(enemyTurn.activeEntityType, "enemy");
    assert.equal(enemyTurn.activeCombatantId, value.goblin.id);
    assert.equal(enemyTurn.current.markerVisible, true);
    assert.equal(value.context.buildMarkerRecord(value.goblin, "goblins", 0).isVisible, true);
    assert.deepEqual(value.combat.turns.map(c => [c.hidden, c.token?.hidden]), before, "display does not reveal tokens or combatants in Foundry");
  });
  test(`disabling hidden enemies removes their payload and condition source names: ${JSON.stringify(visibility)}`, () => {
    const value = arena({ ...visibility, showHiddenEnemies: false });
    value.combat.combatant = value.goblin; value.combat.turn = 1;
    const state = value.context.buildDashboardState();
    assert.equal(state.groups.length, 0);
    assert.equal(state.current.id, value.player.id, "focus advances to next eligible visible turn");
    assert.equal(state.current.activeEffects[0].label, "Gepackt");
    assert.doesNotMatch(JSON.stringify(state), /goblin-a|Goblin 1/);
    assert.equal(value.context.buildMarkerRecord(value.goblin, "goblins", 0).isVisible, false);
  });
}

test("default preference displays token-hidden enemies and can be toggled without changing token visibility", () => {
  const value = arena({ tokenHidden: true });
  assert.ok(groupFor(value.context.buildDashboardState(), value.goblin.id));
  value.preferences.showHiddenEnemies = false;
  assert.equal(value.context.buildDashboardState().groups.length, 0);
  value.preferences.showHiddenEnemies = true;
  assert.ok(groupFor(value.context.buildDashboardState(), value.goblin.id));
  assert.equal(value.goblin.token.hidden, true);
  assert.equal(value.goblin.hidden, false);
});

for (const showHiddenEnemies of [false, true]) test(`hidden players stay excluded with showHiddenEnemies=${showHiddenEnemies}`, () => {
  const value = arena({ playerHidden: true, showHiddenEnemies });
  const state = value.context.buildDashboardState();
  assert.ok(state.initiative.every(entry => entry.combatantId !== value.player.id));
  assert.equal(state.current.id, value.goblin.id);
  assert.equal(value.context.isCombatantVisibleOnWall(value.player), false);
});

test("defeated hidden enemies count in the group but never supply active focus or markers", () => {
  const value = arena({ tokenHidden: true, showHiddenEnemies: true, secondEnemy: true });
  value.goblin.defeated = true;
  value.combat.combatant = value.goblin; value.combat.turn = 1;
  const state = value.context.buildDashboardState();
  const group = groupFor(state, value.goblin.id);
  assert.equal(group.total, 2);
  assert.equal(group.living, 1);
  assert.equal(group.defeated, 1);
  assert.equal(state.current.id, value.goblinB.id);
  assert.deepEqual(Array.from(group.groupMarkers, marker => marker.combatantId), [value.goblinB.id]);
  value.goblinB.defeated = true;
  const dead = value.context.buildDashboardState();
  assert.ok(dead.initiative.every(entry => entry.kind !== "group"));
  assert.equal(dead.current.id, value.player.id);
  assert.equal(dead.groups[0].allDefeated, true);
  assert.equal(dead.groups[0].groupMarkers.length, 0);
});

for (const [name, file] of Object.entries({
  "Nova Schaltkreis": "nova", "Zane Lied": "zane", "Orsik Stein": "orsik", "Flab": "orsik",
  Ray: "ray", Ziggs: "ray", "Lichtwölkchen": "lichtwoelkchen", "Lichtwoelkchen Sturm": "lichtwoelkchen", Pyro: "pyro"
})) test(`full encounter uses correct portrait for ${name}`, () => {
  const value = arena({ playerName: name });
  const state = value.context.buildDashboardState();
  const entry = state.initiative.find(entry => entry.combatantId === value.player.id);
  assert.equal(entry.image, portraitUrl(file), "initiative portrait uses bundled player image");
  assert.equal(state.current.focusImage, portraitUrl(file));
  assert.equal(state.current.image, entry.image, "initiative and focus use same portrait resolver");
  assert.equal(state.current.name, name);
});

test("player-name prefix matching respects word boundaries", () => {
  const value = arena({ playerName: "Novak" });
  const state = value.context.buildDashboardState();
  assert.ok(!state.current.focusImage.endsWith("/nova.png"));
  assert.equal(state.current.focusImage, "https://example.invalid/foundry/icons/svg/mystery-man.svg");
});

test("exact full-name custom image and combatant flag override bundled portrait consistently", () => {
  const value = arena({ playerName: "Nova Schaltkreis", images: { "nova-schaltkreis": "custom/nova.png" } });
  let state = value.context.buildDashboardState();
  assert.equal(state.current.focusImage, "https://example.invalid/foundry/custom/nova.png");
  assert.equal(state.initiative[0].image, state.current.focusImage);
  value.playerFlags.focusImage = "https://cdn.example.invalid/portrait.png";
  state = value.context.buildDashboardState();
  assert.equal(state.current.focusImage, "https://cdn.example.invalid/portrait.png");
  assert.equal(state.initiative[0].image, state.current.focusImage);
});

test("precombat preview shows first visible player's portrait without marking an active turn", () => {
  const value = arena({ playerName: "Orsik", started: false, tokenHidden: true });
  const state = value.context.buildDashboardState();
  assert.equal(state.combatActive, false);
  assert.equal(state.current, null);
  assert.equal(state.activeCombatantId, null);
  assert.equal(state.preview.name, "Orsik");
  assert.equal(state.preview.preview, true);
  assert.equal(state.preview.focusImage, portraitUrl("orsik"));
  assert.ok(state.initiative.every(entry => !entry.active));
  assert.equal(value.combat.combatant, null);
  assert.equal(value.combat.turn, null);
});

test("precombat preview skips hidden players", () => {
  const value = arena({ playerName: "Zane", started: false, playerHidden: true });
  const visible = { id: "visible-player", name: "Ziggs", initiative: 12, img: "icons/svg/mystery-man.svg", getFlag() {} };
  value.combat.turns.push(visible);
  const state = value.context.buildDashboardState();
  assert.equal(state.preview.name, "Ziggs");
  assert.equal(state.preview.focusImage, portraitUrl("ray"));
  assert.equal(state.activeCombatantId, null);
});

test("group synchronization includes hidden enemies when enabled without writing visibility fields", async () => {
  async function synchronize(showHiddenEnemies) {
    const value = arena({ showHiddenEnemies, tokenHidden: true, combatantHidden: true, secondEnemy: true });
    const writes = [];
    const flags = [];
    value.combat.groups = { contents: [] };
    value.combat.getFlag = () => undefined;
    value.combat.createEmbeddedDocuments = async (type, data) => {
      writes.push({ operation: "create", type, data });
      return data.map((record, index) => ({ ...record, id: `managed-group-${index}`,
        getFlag: (scope, key) => record.flags?.[scope]?.[key] }));
    };
    value.combat.updateEmbeddedDocuments = async (type, data) => {
      writes.push({ operation: "update", type, data });
      return [];
    };
    value.combat.deleteEmbeddedDocuments = async (type, data) => {
      writes.push({ operation: "delete", type, data });
      return [];
    };
    value.combat.setFlag = async (scope, key, data) => flags.push({ scope, key, data });
    await value.context.synchronizeNpcGroups(value.combat);
    return { ...value, writes, flags };
  }
  const shown = await synchronize(true);
  const created = shown.writes.find(write => write.operation === "create" && write.type === "CombatantGroup");
  assert.ok(created, "hidden same-group enemies receive their normal managed group");
  assert.equal(created.data.length, 1);
  const members = shown.writes.find(write => write.operation === "update" && write.type === "Combatant");
  assert.deepEqual(Array.from(members.data, member => member._id), [shown.goblin.id, shown.goblinB.id]);
  assert.ok(members.data.every(member => member.group === "managed-group-0"));
  assert.ok(shown.writes.every(write => write.type !== "Token"));
  assert.ok(shown.writes.filter(write => write.type === "Combatant").every(write =>
    write.data.every(record => Object.keys(record).every(key => ["_id", "group", "initiative"].includes(key)))));
  assert.equal(shown.flags.length, 1);
  assert.equal(shown.flags[0].key, "segmentOrder");
  assert.deepEqual(Array.from(shown.flags[0].data.goblins), [shown.goblin.id, shown.goblinB.id]);
  assert.equal(shown.goblin.hidden, true);
  assert.equal(shown.goblin.token.hidden, true);
  assert.equal(shown.goblinB.hidden, true);
  assert.equal(shown.goblinB.token.hidden, true);
  const excluded = await synchronize(false);
  assert.equal(excluded.writes.length, 0, "disabled hidden enemies do not produce new managed groups");
});
