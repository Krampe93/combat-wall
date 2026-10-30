const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../scripts/main-1.1.0.js"), "utf8");

function arena({ second = false, hidden = false, tokenHidden = false, api = true, placeholder = false } = {}) {
  const scene = { id: "arena", documentName: "Scene", dimensions: { sceneRect: { x: 0, y: 0, width: 1000, height: 600 }, size: 100 } };
  const zane = { id: "zane-actor", uuid: "Actor.zane", name: "Zane", type: "character", hasPlayerOwner: true,
    statuses: new Set(["grappled"]), effects: [], system: { attributes: { hp: { value: 20, max: 20 } } } };
  const npc = (id, name) => ({ id, uuid: `Scene.arena.Token.${id}.Actor.goblin`, name, type: "npc", statuses: new Set(), effects: [],
    system: { attributes: { hp: { value: 10, max: 10 } }, traits: { size: "sm" } } });
  const actor = npc("goblin-a", hidden || tokenHidden ? "Geheimer Goblin" : "Goblin 1");
  const actorB = npc("goblin-b", "Goblin 2");
  const doc = (id, actor, initiative) => ({ id, actor, actorId: actor?.id, name: actor?.name ?? "Zane", initiative,
    token: { id, uuid: `Scene.arena.Token.${id}`, parent: scene, x: 100, y: 100, width: 1, height: 1 }, getFlag() {} });
  const player = doc("zane", placeholder ? null : zane, 20);
  const goblin = doc("goblin-a", actor, 15);
  goblin.hidden = hidden; goblin.token.hidden = tokenHidden;
  const goblinB = doc("goblin-b", actorB, 12);
  const turns = [player, goblin, ...(second ? [goblinB] : [])];
  const combat = { id: "fight", started: true, round: 1, turn: 0, turns, combatant: player, scene, getFlag: () => ({}) };
  const relation = { statusId: "grappled", label: "Gepackt",
    source: { uuid: goblin.token.uuid, tokenUuid: goblin.token.uuid, actorUuid: actor.uuid, combatantId: goblin.id, combatId: combat.id, name: actor.name },
    target: { actorUuid: zane.uuid, combatantId: placeholder ? null : player.id, combatId: combat.id } };
  const effect = { id: "grappled", name: "Grappled", statuses: new Set(["grappled"]), duration: { rounds: 3 }, flags: {
    "gm-combat-workspace": { conditionSources: { grappled: relation.source } }
  } };
  zane.effects.push(effect);
  let relations = [relation];
  const game = { user: { isGM: true }, world: { id: "arena" }, combat, actors: new Map([[zane.id, zane]]),
    settings: { get: () => ({}) }, scenes: { current: scene }, modules: new Map(api ? [["gm-combat-workspace", { api: { getConditionRelations: () => relations } }]] : []) };
  const readyHooks = new Map();
  const context = vm.createContext({ console, Hooks: { once(name, callback) { readyHooks.set(name, callback); }, on() {} }, game,
    window: { location: { origin: "https://example.invalid" }, clearTimeout() {}, setTimeout() {} },
    globalThis: { canvas: { scene } }, foundry: { utils: {
      getProperty: (object, key) => key.split(".").reduce((value, part) => value?.[part], object), getRoute: value => `/${value}`
    } }, URL, URLSearchParams, BroadcastChannel: class {} });
  vm.runInContext(source, context);
  return { context, game, combat, relation, effect, zane, goblin, goblinB, readyHooks, setRelations(value) { relations = value; } };
}

function member(state, id) { return state.groups.flatMap(group => group.members).find(member => member.id === id); }

test("a single link displays Gepackt von on the player and Packt gerade on the NPC", () => {
  const { context, combat, goblin } = arena();
  const state = context.buildDashboardState();
  assert.equal(state.current.activeEffects[0].label, "Gepackt von Goblin 1");
  assert.equal(member(state, goblin.id).conditionLinks[0].text, "Packt gerade Zane");
  assert.equal(member(state, goblin.id).activeEffects[0].label, "Packt gerade Zane");
  assert.equal(member(state, goblin.id).activeEffects[0].durationLabel, "3 Runden");
  assert.ok(state.initiative.some(entry => entry.conditionLinks.some(link => link.text === "Gepackt von Goblin 1")));
  assert.ok(state.initiative.some(entry => entry.conditionLinks.some(link => link.text === "Packt gerade Zane")));
  assert.equal(combat.turn, 0);
  assert.equal(goblin.actor.statuses.size, 0, "display enrichment does not change native state");
});

test("changing the source moves the counterpart to the correct same-name NPC token", () => {
  const arenaState = arena({ second: true });
  arenaState.relation.source.combatId = "previous-encounter";
  assert.equal(arenaState.context.buildDashboardState().current.activeEffects[0].label, "Gepackt von Goblin 1",
    "the same persistent token remains identifiable after a different encounter document is opened");
  arenaState.relation.source = { uuid: arenaState.goblinB.token.uuid, tokenUuid: arenaState.goblinB.token.uuid, name: "Goblin 2" };
  const state = arenaState.context.buildDashboardState();
  assert.equal(state.current.activeEffects[0].label, "Gepackt von Goblin 2");
  assert.equal(member(state, "goblin-a").conditionLinks.length, 0);
  assert.equal(member(state, "goblin-b").conditionLinks[0].text, "Packt gerade Zane");
});

test("removing one link clears both derived displays without stale synthetic effects", () => {
  const state = arena();
  state.context.buildDashboardState();
  state.setRelations([]); state.zane.effects = []; state.zane.statuses.clear();
  const result = state.context.buildDashboardState();
  assert.equal(result.current.activeEffects.length, 0);
  assert.equal(member(result, "goblin-a").activeEffects.length, 0);
  assert.ok(result.initiative.every(entry => entry.conditionLinks.length === 0));
});

for (const visibility of [{ hidden: true }, { tokenHidden: true }]) test(`hidden endpoint is never disclosed: ${JSON.stringify(visibility)}`, () => {
  const state = arena(visibility).context.buildDashboardState();
  const json = JSON.stringify(state);
  assert.doesNotMatch(json, /Geheimer Goblin|goblin-a/);
  assert.equal(state.current.activeEffects[0].label, "Gepackt", "native state remains visible without the hidden source name");
});

test("native effect flags provide the same pair when the workspace API is unavailable", () => {
  const value = arena({ api: false });
  const state = value.context.buildDashboardState();
  assert.equal(state.current.activeEffects[0].label, "Gepackt von Goblin 1");
  assert.equal(state.current.activeEffects[0].durationLabel, "3 Runden");
  assert.equal(member(state, "goblin-a").conditionLinks[0].text, "Packt gerade Zane");
  value.effect.flags = {};
  value.effect.getFlag = () => { throw new Error("unknown module scope"); };
  assert.doesNotThrow(() => value.context.buildDashboardState(), "native effects still render when the optional workspace is not installed");
});

test("a uniquely named player placeholder resolves the actual character condition", () => {
  const state = arena({ placeholder: true }).context.buildDashboardState();
  assert.equal(state.current.kind, "placeholder");
  assert.equal(state.current.activeEffects[0].label, "Gepackt von Goblin 1");
  assert.equal(member(state, "goblin-a").conditionLinks[0].text, "Packt gerade Zane");
});

test("the reverse relation gives the player an outgoing display and NPC the incoming display", () => {
  const value = arena();
  value.zane.effects = []; value.zane.statuses.clear();
  value.relation.source = { uuid: value.zane.uuid, actorUuid: value.zane.uuid };
  value.relation.target = { combatantId: value.goblin.id, combatId: value.combat.id, tokenUuid: value.goblin.token.uuid };
  const state = value.context.buildDashboardState();
  assert.equal(state.current.activeEffects[0].label, "Packt gerade Goblin 1");
  assert.equal(member(state, "goblin-a").activeEffects[0].label, "Gepackt von Zane");
});

test("disabled native effects do not retain fallback relationships", () => {
  const value = arena({ api: false });
  value.effect.disabled = true; value.zane.statuses.clear();
  const state = value.context.buildDashboardState();
  assert.equal(state.current.activeEffects.length, 0);
  assert.equal(member(state, "goblin-a").conditionLinks.length, 0);
});

test("the workspace companion does not start a second Combat Wall publisher", () => {
  const value = arena();
  value.context.window.location.search = "?gmCombatWorkspace=1";
  assert.doesNotThrow(() => value.readyHooks.get("ready")(), "companion must exit before accessing UI or opening a publisher");
});
