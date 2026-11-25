const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/main-1.1.8.js'), 'utf8');

class Documents extends Map {
  get contents() { return [...this.values()]; }
  [Symbol.iterator]() { return this.values(); }
}

function arena({ count = 7, flags = {}, showHiddenEnemies = false } = {}) {
  const scene = { id: 'arena', documentName: 'Scene', dimensions: {
    sceneRect: { x: 0, y: 0, width: 2000, height: 2000 }, size: 100
  } };
  const writes = [], groups = new Documents(), preferences = { showHiddenEnemies };
  const player = { id: 'player', name: 'Nova', initiative: 30, getFlag() {} };
  function enemy(index, group = index < 2 ? 'dragons' : `group-${index}`) {
    const id = `enemy-${String(index).padStart(3, '0')}`;
    const actor = { id: `actor-${group}`, uuid: `Actor.${group}`, type: 'npc', name: group,
      statuses: new Set(), effects: [], system: { attributes: { hp: { value: 10, max: 10 } }, traits: { size: 'med' } } };
    return { id, actor, actorId: actor.id, name: `Enemy ${index}`, initiative: 20 - index,
      tokenId: `token-${id}`, token: { id: `token-${id}`, parent: scene, x: index * 15, y: 200, width: 1, height: 1 },
      flags: { 'combat-wall': { groupId: group } },
      getFlag(scope, key) { return this.flags[scope]?.[key]; }
    };
  }
  const enemies = Array.from({ length: count }, (_, index) => enemy(index));
  const combat = { id: 'fight', scene, started: true, round: 1, turn: 0, combatant: player,
    turns: [player, ...enemies], combatants: new Documents([player, ...enemies].map(entry => [entry.id, entry])), groups,
    flags: { 'combat-wall': structuredClone(flags) },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) { writes.push({ scope, key, value: structuredClone(value) }); (this.flags[scope] ??= {})[key] = structuredClone(value); },
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, 'CombatantGroup');
      return data.map((entry, index) => {
        const doc = { ...entry, id: `group-${groups.size + index}`, getFlag(scope, key) { return this.flags[scope]?.[key]; } };
        groups.set(doc.id, doc); return doc;
      });
    },
    async updateEmbeddedDocuments(type, updates) {
      const documents = type === 'CombatantGroup' ? groups : this.combatants;
      for (const { _id, ...update } of updates) Object.assign(documents.get(_id), update);
    },
    async deleteEmbeddedDocuments(type, ids) { assert.equal(type, 'CombatantGroup'); for (const id of ids) groups.delete(id); }
  };
  const module = { api: {} };
  const game = { user: { isGM: true }, world: { id: 'color-test' }, combat, scenes: { current: scene }, actors: new Documents(),
    settings: { get: (_scope, key) => key === 'showHiddenEnemies' ? preferences.showHiddenEnemies : {} },
    modules: new Map([['combat-wall', module]]), i18n: { localize: value => value }
  };
  function loadContext() {
    const context = vm.createContext({ console: { ...console, table() {} }, game,
      Hooks: { once() {}, on() {}, callAll() {} },
      window: { location: { origin: 'https://example.invalid' }, clearTimeout() {}, setTimeout() {} },
      globalThis: { canvas: { scene } }, foundry: { utils: {
        getProperty: (object, property) => property.split('.').reduce((value, key) => value?.[key], object),
        getRoute: value => `/${String(value).replace(/^\/+/, '')}`
      } }, URL, URLSearchParams, BroadcastChannel: class { addEventListener() {} postMessage() {} }
    });
    vm.runInContext(source, context); return context;
  }
  return { context: loadContext(), loadContext, combat, game, module, enemies, player, writes, preferences, enemy };
}

function colorMap(context) {
  return Object.fromEntries(context.buildDashboardState().groups.flatMap(group => group.members.map(member => [member.id, member.markerColor])));
}

function assertColorsUnique(colors, expected) {
  assert.equal(Object.keys(colors).length, expected);
  for (const color of Object.values(colors)) assert.match(color, /^#[0-9a-f]{6}$/i);
  assert.equal(new Set(Object.values(colors).map(color => color.toLowerCase())).size, expected);
}

test('two dragons and five other groups have unique encounter-wide colors without conflating member positions', async () => {
  const value = arena();
  await value.context.synchronizeNpcGroups(value.combat);
  const state = value.context.buildDashboardState();
  assert.equal(state.groups.length, 6);
  assertColorsUnique(colorMap(value.context), 7);
  const singletons = state.groups.filter(group => group.members.length === 1);
  assert.equal(singletons.length, 5);
  assert.ok(singletons.every(group => group.members[0].stableMemberIndex === 0), 'segment indices remain local to each group');
  assert.equal(new Set(singletons.map(group => group.members[0].markerColor)).size, 5);
});

for (const count of [40, 64]) test(`${count} NPCs get distinct valid colors beyond the original eight-color palette`, async () => {
  const value = arena({ count });
  await value.context.synchronizeNpcGroups(value.combat);
  assertColorsUnique(colorMap(value.context), count);
});

test('state and public reads assign colors without mutating or writing encounter flags', () => {
  const value = arena({ count: 40 });
  const before = JSON.stringify(value.combat.flags);
  const colors = colorMap(value.context);
  value.context.exposeDebugApi();
  value.module.api.getMarkerColors();
  value.context.getMarkerData(value.enemies[0].id);
  value.context.getGroupMarkerData(value.context.buildDashboardState().groups[0].id);
  value.context.inspectMarkers(); value.context.inspectCombatants();
  assert.deepEqual(colorMap(value.context), colors);
  assert.equal(value.writes.length, 0);
  assert.equal(JSON.stringify(value.combat.flags), before);
});

test('authoritative synchronization persists all NPC slots including hidden/defeated entries and new arrivals', async () => {
  const value = arena();
  value.enemies[0].hidden = true;
  value.enemies[1].defeated = true;
  await value.context.synchronizeNpcGroups(value.combat);
  const first = value.combat.getFlag('combat-wall', 'markerColorSlots');
  assert.equal(Object.keys(first).length, 7);
  assert.ok(Object.values(first).every(slot => Number.isInteger(slot) && slot >= 0));
  assert.equal(new Set(Object.values(first)).size, 7);
  assert.equal(first.player, undefined);
  assert.ok(value.writes.some(write => write.key === 'markerColorSlots'));
  const arrival = value.enemy(99);
  value.combat.combatants.set(arrival.id, arrival); value.combat.turns.push(arrival);
  await value.context.synchronizeNpcGroups(value.combat);
  const second = value.combat.getFlag('combat-wall', 'markerColorSlots');
  for (const [id, slot] of Object.entries(first)) assert.equal(second[id], slot);
  assert.ok(second[arrival.id] > Math.max(...Object.values(first)));
});

test('new earlier-sorting NPCs cannot recolor participants between the initial state read and synchronization', async () => {
  const value = arena({ count: 40 });
  const initial = colorMap(value.context);
  const arrival = value.enemy(99);
  arrival.id = 'aaa-arrival';
  value.combat.combatants.set(arrival.id, arrival); value.combat.turns.unshift(arrival);
  const beforeSync = colorMap(value.context);
  for (const [id, color] of Object.entries(initial)) assert.equal(beforeSync[id], color);
  assertColorsUnique(beforeSync, 41);
  assert.equal(value.writes.length, 0);
  await value.context.synchronizeNpcGroups(value.combat);
  assert.deepEqual(colorMap(value.context), beforeSync);
  assert.deepEqual(colorMap(value.loadContext()), beforeSync, 'persisted provisional assignments survive a fresh runtime');
});

test('turn, initiative, group order, position, hiding, death, addition and removal preserve assigned NPC colors', async () => {
  const value = arena({ count: 40 });
  await value.context.synchronizeNpcGroups(value.combat);
  const initial = colorMap(value.context);
  function verifyRemaining() {
    const current = colorMap(value.context);
    for (const [id, color] of Object.entries(current)) if (id in initial) assert.equal(color, initial[id], id);
  }
  value.combat.turn = 8; value.combat.combatant = value.enemies[7]; value.combat.round++;
  value.combat.turns.reverse(); value.enemies.forEach((entry, index) => { entry.initiative = index; entry.token.x = 1000 - index; });
  verifyRemaining();
  for (const order of Object.values(value.combat.flags['combat-wall'].segmentOrder)) order.reverse();
  value.enemies[4].flags['combat-wall'].groupId = 'dragons';
  await value.context.synchronizeNpcGroups(value.combat); verifyRemaining();
  value.enemies[0].hidden = true; value.enemies[1].token.hidden = true; value.enemies[2].defeated = true;
  verifyRemaining();
  value.preferences.showHiddenEnemies = true; verifyRemaining();
  const removed = value.enemies[3];
  value.combat.combatants.delete(removed.id); value.combat.turns = value.combat.turns.filter(entry => entry.id !== removed.id);
  const arrival = value.enemy(100); value.combat.combatants.set(arrival.id, arrival); value.combat.turns.unshift(arrival);
  await value.context.synchronizeNpcGroups(value.combat); verifyRemaining();
  const slots = value.combat.getFlag('combat-wall', 'markerColorSlots');
  assert.ok(Number.isInteger(slots[removed.id]), 'removed IDs reserve their previous colors');
  assert.ok(!Object.values(initial).includes(colorMap(value.context)[arrival.id]), 'a new NPC does not reuse removed or hidden colors');
  value.combat.combatants.set(removed.id, removed); value.combat.turns.push(removed);
  await value.context.synchronizeNpcGroups(value.combat); verifyRemaining();
});

test('persisted colors survive a fresh VM and changed participant order', async () => {
  const first = arena({ count: 40 });
  await first.context.synchronizeNpcGroups(first.combat);
  const colors = colorMap(first.context);
  const second = arena({ count: 40, flags: first.combat.flags['combat-wall'] });
  second.combat.turns.reverse();
  second.combat.combatants = new Documents([...second.combat.combatants.contents].reverse().map(entry => [entry.id, entry]));
  assert.deepEqual(colorMap(second.context), colors);
  assert.equal(second.writes.length, 0);
});

test('public marker colors, individual/group lookups and inspect views agree on every NPC color', async () => {
  const value = arena({ count: 40 });
  await value.context.synchronizeNpcGroups(value.combat);
  value.context.exposeDebugApi();
  const colors = colorMap(value.context);
  for (const marker of value.module.api.getMarkerColors().markers) assert.equal(marker.color, colors[marker.combatantId]);
  for (const group of value.context.buildDashboardState().groups) {
    for (const marker of value.context.getGroupMarkerData(group.id)) {
      assert.equal(marker.color, colors[marker.combatantId]);
      assert.equal(value.context.getMarkerData(marker.combatantId).color, marker.color);
    }
  }
  for (const row of value.context.inspectMarkers()) assert.equal(row.color, colors[row.combatantId]);
  const idsByName = new Map(value.enemies.map(entry => [entry.name, entry.id]));
  for (const row of value.context.inspectCombatants().filter(row => row['Erkannte Art'] === 'npc')) {
    assert.equal(row.markerColor, colors[idsByName.get(row.Name)]);
  }
});
