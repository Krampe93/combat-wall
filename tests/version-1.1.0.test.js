const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "scripts", "main-1.1.0.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "dashboard", "dashboard-1.1.0.js"), "utf8");
const css = fs.readFileSync(path.join(root, "dashboard", "dashboard-1.1.0.css"), "utf8");
const index = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));

assert.equal(manifest.version, "1.1.0");
assert.deepEqual(manifest.esmodules, ["scripts/main-1.1.0.js"]);
assert.match(index, /dashboard-1\.1\.0\.css\?v=1\.1\.0/);
assert.match(index, /dashboard-1\.1\.0\.js\?v=1\.1\.0/);
assert.match(main, /function serializeActiveEffects/);
assert.match(main, /function translateEffectName/);
assert.match(main, /function resolveBloodiedState/);
assert.match(main, /function resolveDisplayedCombatant/);
assert.match(main, /function isCombatWallTurnEligible/);
assert.match(main, /hpValue > 0 && hpValue <= threshold/);
assert.match(dashboard, /createEffectCard/);
assert.match(dashboard, /heading\.textContent = "ZUSTÄNDE"/);
assert.match(dashboard, /empty\.textContent = "Keine Zustände"/);
assert.doesNotMatch(
  dashboard.match(/function createMemberSegment\(member\) \{[\s\S]*?^  \}/m)[0],
  /member\.statuses|createStatusBadge/
);
assert.match(dashboard, /classList\.toggle\("bloodied"/);
assert.match(css, /\.focus-card\.bloodied/);
assert.match(css, /\.focus-effects/);
assert.match(css, /@keyframes focus-effect-enter/);
assert.match(css, /\.position-marker\.bloodied/);
assert.match(css, /\.defeated-card-overlay/);
assert.match(dashboard, /group\.members\.filter\(\(member\) => !member\.defeated\)/);
assert.match(dashboard, /allDefeated: Boolean\(group\.allDefeated\)/);

const context = vm.createContext({
  console,
  Hooks: { once() {}, on() {} },
  window: { clearTimeout() {}, setTimeout() {}, location: { origin: "https://example.invalid" } },
  globalThis: {},
  game: {},
  foundry: {
    utils: {
      getProperty(object, propertyPath) {
        return propertyPath.split(".").reduce((value, key) => value?.[key], object);
      },
      getRoute(value) { return `/${value}`; }
    }
  },
  URL,
  BroadcastChannel: class {}
});
vm.runInContext(main, context);
context.globalThis.canvas = { scene: { id: "scene-1" } };

function rawNpc(id, hp, { hidden = false, defeated = false } = {}) {
  return {
    id,
    hidden,
    defeated,
    actor: {
      type: "npc",
      system: { attributes: { hp: { value: hp, max: 10 } } }
    },
    token: {
      id: `token-${id}`,
      parent: { id: "scene-1", documentName: "Scene" }
    }
  };
}

{
  const dead = rawNpc("dead", 0);
  const next = rawNpc("next", 7);
  const later = rawNpc("later", 9);
  assert.equal(context.resolveDisplayedCombatant([dead, next, later], dead).id, "next");
}

{
  const dead = rawNpc("dead", 0);
  const defeated = rawNpc("defeated", 5, { defeated: true });
  const living = rawNpc("living", 4);
  assert.equal(context.resolveDisplayedCombatant([living, dead, defeated], dead).id, "living");
}

{
  const dead = rawNpc("dead", 0);
  const defeated = rawNpc("defeated", 0);
  assert.equal(context.resolveDisplayedCombatant([dead, defeated], dead), null);
}

{
  const members = [
    { id: "dead", kind: "npc", groupId: "dead-group", groupName: "Tote", turnIndex: 0 },
    { id: "living", kind: "npc", groupId: "living-group", groupName: "Lebende", turnIndex: 1 }
  ];
  const groups = [
    { id: "dead-group", allDefeated: true },
    {
      id: "living-group",
      allDefeated: false,
      name: "Lebende",
      activeMember: 1,
      activeCombatantId: "living"
    }
  ];
  const initiative = context.buildPublicInitiative(members, groups, "living");
  assert.deepEqual(Array.from(initiative, (entry) => entry.groupId), ["living-group"]);
  assert.equal(initiative[0].active, true);
}

{
  const deadMember = {
    id: "dead",
    kind: "npc",
    groupId: "goblins",
    groupName: "Goblins",
    turnIndex: 0,
    initiative: 12,
    defeated: true,
    markerVisible: true,
    markerColor: "#fff",
    stableMemberIndex: 0
  };
  const livingMember = {
    ...deadMember,
    id: "living",
    turnIndex: 1,
    defeated: false,
    stableMemberIndex: 1
  };
  const group = context.buildNpcGroups([deadMember, livingMember])[0];
  assert.equal(group.living, 1);
  assert.equal(group.total, 2);
  assert.deepEqual(Array.from(group.groupMarkers, (marker) => marker.combatantId), ["living"]);
  assert.equal(context.buildCurrentEntry({ id: "dead" }, [deadMember, livingMember], [group]), null);
}

assert.equal(context.resolveBloodiedState(100, 100).isBloodied, false);
assert.equal(context.resolveBloodiedState(50, 100).isBloodied, true);
assert.equal(context.resolveBloodiedState(49, 100).isBloodied, true);
assert.equal(context.resolveBloodiedState(51, 100).isBloodied, false);
assert.equal(context.resolveBloodiedState(0, 100).isBloodied, false);

const unknown = context.serializeActiveEffects({
  effects: [{ id: "custom", name: "Schleimfluch", disabled: false, duration: {} }]
});
assert.equal(unknown[0].label, "Schleimfluch");
assert.equal(unknown[0].durationLabel, null);

const poisoned = context.serializeActiveEffects({
  effects: [{
    id: "poisoned",
    name: "Poisoned",
    statuses: new Set(["poisoned"]),
    disabled: false,
    duration: { rounds: 2, remaining: 2 }
  }]
});
assert.equal(poisoned[0].label, "Vergiftet");
assert.equal(poisoned[0].durationLabel, "2 Runden");

console.log("Combat Wall 1.1.0 dead display checks passed.");
