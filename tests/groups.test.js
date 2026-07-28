const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("scripts/main-0.6.1.js", "utf8");
const context = vm.createContext({
  console,
  Hooks: { once() {}, on() {} },
  window: {
    clearTimeout() {},
    setTimeout() {},
    location: { origin: "https://example.invalid" }
  },
  game: {},
  foundry: {
    utils: {
      getProperty(object, path) {
        return path.split(".").reduce((value, key) => value?.[key], object);
      },
      getRoute(path) {
        return `/${path}`;
      }
    }
  },
  URL,
  BroadcastChannel: class {}
});
vm.runInContext(source, context);

function npc(id, groupId, turnIndex, { active = false, defeated = false } = {}) {
  return {
    id,
    kind: "npc",
    groupId,
    groupName: groupId,
    name: id,
    image: `${id}.webp`,
    initiative: 12,
    turnIndex,
    groupPosition: turnIndex + 1,
    active,
    defeated,
    size: "medium",
    layoutWeight: 1,
    statuses: []
  };
}

function player(id, turnIndex, active = false) {
  return {
    id,
    kind: "placeholder",
    name: id,
    image: `${id}.webp`,
    initiative: 10,
    turnIndex,
    active,
    defeated: false,
    statuses: []
  };
}

function state(members, activeId) {
  const groups = context.buildNpcGroups(members);
  return {
    groups,
    initiative: context.buildPublicInitiative(members, groups, activeId),
    current: context.buildCurrentEntry(
      { id: activeId },
      members,
      groups
    )
  };
}

{
  const members = [
    player("Orsik", 0),
    npc("Skelett 1", "skelette", 1, { active: true }),
    npc("Skelett 2", "skelette", 2),
    player("Nova", 3)
  ];
  const result = state(members, "Skelett 1");
  assert.deepEqual(
    Array.from(result.initiative, (entry) => entry.name),
    ["Orsik", "skelette", "Nova"]
  );
  assert.equal(result.initiative[1].active, true);
  assert.equal(result.initiative[1].activeGroupPosition, 1);
  assert.equal(result.initiative[1].activeGroupCount, 2);
  assert.equal(result.current.activeCombatantId, "Skelett 1");
}

{
  const members = [
    npc("Skelett 1", "skelette", 0, { defeated: true }),
    npc("Skelett 2", "skelette", 1, { active: true }),
    npc("Skelett 3", "skelette", 2)
  ];
  const result = state(members, "Skelett 2");
  assert.equal(result.groups[0].totalMembers, 3);
  assert.equal(result.groups[0].activeMembers, 2);
  assert.equal(result.groups[0].actionableMembers, 2);
  assert.equal(result.current.activeGroupPosition, 1);
  assert.equal(result.current.activeGroupCount, 2);
}

{
  const members = [
    npc("Skelett 1", "skelette", 0),
    npc("Kultist 1", "kultisten", 1, { active: true }),
    npc("Kultist 2", "kultisten", 2),
    player("Zane", 3)
  ];
  const result = state(members, "Kultist 1");
  assert.equal(result.initiative.length, 3);
  assert.equal(result.initiative.filter((entry) => entry.kind === "group").length, 2);
  assert.equal(result.initiative.find((entry) => entry.active).groupId, "kultisten");
}

console.log("Combat Wall 0.6.1 group tests passed.");
