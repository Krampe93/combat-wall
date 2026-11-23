const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/main-1.1.7.js'), 'utf8');

function arena({ showHiddenEnemies = false } = {}) {
  const scene = { id: 'arena', documentName: 'Scene', dimensions: { sceneRect: { x: 0, y: 0, width: 1000, height: 600 }, size: 100 } };
  const actor = { id: 'npc-actor', uuid: 'Actor.npc', name: 'NPC', type: 'npc', statuses: new Set(), effects: [],
    system: { attributes: { hp: { value: 10, max: 10 } }, traits: { size: 'sm' } } };
  const order = { alpha: ['alpha-b', 'alpha-a'], beta: ['beta-b', 'beta-a'] };
  const enemy = (id, group, index) => ({ id, actor, actorId: actor.id, name: `Enemy ${id}`, initiative: 20 - index,
    tokenId: `token-${id}`, token: { id: `token-${id}`, parent: scene, x: index * 100, y: 100, width: 1, height: 1 },
    getFlag: (scope, key) => scope === 'combat-wall' && key === 'groupId' ? group : undefined });
  const enemies = [enemy('alpha-a', 'alpha', 0), enemy('alpha-b', 'alpha', 1), enemy('beta-a', 'beta', 2), enemy('beta-b', 'beta', 3)];
  const player = { id: 'player', name: 'Nova', initiative: 30, getFlag() {} };
  const turns = [player, ...enemies];
  const combat = { id: 'fight', scene, started: true, round: 1, turn: 0, combatant: player, turns,
    combatants: { contents: turns }, getFlag: (scope, key) => key === 'segmentOrder' ? order : undefined };
  const module = { api: { preserved: true } };
  const game = { user: { isGM: true }, combat, world: { id: 'test-world' }, scenes: { current: scene }, actors: new Map(),
    settings: { get: (scope, key) => key === 'showHiddenEnemies' ? showHiddenEnemies : {} },
    modules: new Map([['combat-wall', module]]), i18n: { localize: value => value } };
  const messages = [], calls = [], eventOrder = [];
  const context = vm.createContext({ console, Hooks: { once() {}, on() {}, callAll(...args) { calls.push(args); eventOrder.push('hook'); } }, game,
    window: { location: { origin: 'https://example.invalid' }, clearTimeout() {}, setTimeout() {} },
    globalThis: { canvas: { scene } }, foundry: { utils: {
      getProperty: (object, property) => property.split('.').reduce((value, key) => value?.[key], object),
      getRoute: value => `/foundry/${String(value).replace(/^\/+/, '')}`
    } }, URL, URLSearchParams, BroadcastChannel: class {
      constructor(name) { this.name = name; } addEventListener() {} postMessage(message) { messages.push(message); eventOrder.push('broadcast'); }
    } });
  vm.runInContext(source, context);
  return { context, game, module, combat, enemies, order, messages, calls, eventOrder, player };
}

test('all core, extended and camelCase condition IDs serialize with German labels and unchanged IDs', () => {
  const { context } = arena();
  const expected = {
    blinded: 'Blind', charmed: 'Bezaubert', deafened: 'Taub', frightened: 'Verängstigt', grappled: 'Gepackt',
    incapacitated: 'Kampfunfähig', invisible: 'Unsichtbar', paralyzed: 'Gelähmt', petrified: 'Versteinert',
    poisoned: 'Vergiftet', prone: 'Liegend', restrained: 'Festgesetzt', stunned: 'Betäubt', unconscious: 'Bewusstlos',
    exhaustion: 'Erschöpft', dead: 'Tot', bleeding: 'Blutend', burning: 'Brennend', cursed: 'Verflucht',
    dehydration: 'Dehydriert', diseased: 'Krank', falling: 'Fallend', malnutrition: 'Mangelernährt', silenced: 'Verstummt',
    suffocation: 'Erstickend', surprised: 'Überrascht', transformed: 'Verwandelt', burrowing: 'Grabend',
    concentrating: 'Konzentriert', coverHalf: 'Halbe Deckung', coverThreeQuarters: 'Dreivierteldeckung',
    coverTotal: 'Volle Deckung', dodging: 'Ausweichend', ethereal: 'Ätherisch', flying: 'Fliegend', hiding: 'Versteckt',
    hovering: 'Schwebend', marked: 'Markiert', sleeping: 'Schlafend', stable: 'Stabil', bloodied: 'Angeschlagen',
    defeated: 'Besiegt', encumbered: 'Belastet', heavilyEncumbered: 'Stark belastet',
    exceedingCarryingCapacity: 'Traglast überschritten', slowed: 'Verlangsamt', weakened: 'Geschwächt'
  };
  for (const [id, label] of Object.entries(expected)) {
    const [effect] = context.serializeActiveEffects({ effects: [{ id: `native-${id}`, name: `DND5E.Con${id}`, statuses: [id] }] });
    assert.equal(effect.label, label, id);
    assert.deepEqual(Array.from(effect.statusIds), [id], 'native status ID is preserved');
  }
  for (const [name, label] of Object.entries({ 'Half Cover': 'Halbe Deckung', 'Three-Quarters Cover': 'Dreivierteldeckung',
    'EFFECT.DND5E.StatusHalfCover': 'Halbe Deckung', 'DND5E.ConPoisoned': 'Vergiftet', 'Heavily Encumbered': 'Stark belastet' })) {
    assert.equal(context.translateEffectName({ name, statuses: [] }), label, name);
  }
  assert.equal(context.translateEffectName({ name: 'Schleimfluch', statuses: [] }), 'Schleimfluch');
  assert.equal(context.germanConditionLabel({ id: 'custom-curse', name: 'MYMODULE.Curse' }, { localize: () => 'Mondfluch' }), 'Mondfluch');
});

test('missing and generic condition icons remain absent while real icons keep their paths', () => {
  const { context } = arena();
  for (const icon of [undefined, '', ' ', 'icons/svg/aura.svg', '/icons/svg/mystery-man.svg',
    'modules/combat-wall/assets/fallback.svg', 'https://assets.example/icons/svg/aura.svg?v=2']) {
    const [effect] = context.serializeActiveEffects({ effects: [{ name: 'Poisoned', statuses: ['poisoned'], img: icon }] });
    assert.equal(effect.icon, null, `no decorative fallback for ${String(icon)}`);
  }
  const [local, remote] = context.serializeActiveEffects({ effects: [
    { name: 'Poisoned', statuses: ['poisoned'], img: 'icons/svg/poison.svg' },
    { name: 'Poisoned', statuses: ['poisoned'], icon: 'https://assets.example/poison.webp' }
  ] });
  assert.equal(local.icon, 'https://example.invalid/foundry/icons/svg/poison.svg');
  assert.equal(remote.icon, 'https://assets.example/poison.webp');
});

test('camelCase condition relationship labels are German on both endpoints', () => {
  const value = arena();
  value.game.modules.set('gm-combat-workspace', { api: { getConditionRelations: () => [{
    statusId: 'coverHalf', label: 'Half Cover', source: { combatId: 'fight', combatantId: value.enemies[0].id },
    target: { combatId: 'fight', combatantId: value.player.id }
  }] } });
  const state = value.context.buildDashboardState();
  assert.equal(state.players[0].activeEffects[0].label, 'Halbe Deckung durch Enemy alpha-a');
  assert.equal(state.groups.flatMap(group => group.members).find(member => member.id === value.enemies[0].id).activeEffects[0].label, 'Halbe Deckung → Nova');
});

test('marker API returns exact stable group-member colors across groups, reorder, and hidden scope', () => {
  const value = arena();
  value.context.exposeDebugApi();
  assert.equal(typeof value.context.window.CombatWall.getMarkerColors, 'function');
  assert.equal(typeof value.module.api.getMarkerColors, 'function');
  assert.equal(value.module.api.preserved, true);
  function verify() {
    const state = value.context.buildDashboardState();
    const expected = state.groups.flatMap(group => group.members.map(member => ({ combatantId: member.id, tokenId: member.tokenId, color: member.markerColor })));
    const data = value.module.api.getMarkerColors();
    assert.deepEqual(Object.keys(data).sort(), ['combatId', 'markers', 'sceneId']);
    assert.equal(data.combatId, value.combat.id);
    assert.equal(data.sceneId, 'arena');
    assert.equal(JSON.stringify(data.markers), JSON.stringify(expected));
    for (const marker of data.markers) {
      assert.deepEqual(Object.keys(marker).sort(), ['color', 'combatantId', 'tokenId']);
      assert.match(marker.color, /^#[0-9a-f]{6}$/i);
    }
    assert.ok(data.markers.every(marker => marker.combatantId !== value.player.id));
    return data;
  }
  const before = verify();
  assert.equal(before.markers.length, 4);
  const initialColors = Object.fromEntries(before.markers.map(marker => [marker.combatantId, marker.color]));
  assert.notEqual(initialColors['alpha-a'], initialColors['alpha-b']);
  assert.notEqual(initialColors['beta-a'], initialColors['beta-b']);
  value.combat.turns.reverse();
  for (const marker of verify().markers) assert.equal(marker.color, initialColors[marker.combatantId]);
  value.enemies[0].hidden = true;
  value.enemies[2].token.hidden = true;
  const hidden = verify();
  assert.deepEqual(Array.from(hidden.markers, marker => marker.combatantId).sort(), ['alpha-b', 'beta-b']);
  value.game.settings.get = (scope, key) => key === 'showHiddenEnemies' ? true : {};
  assert.equal(verify().markers.length, 4);
  value.game.combat = null;
  const empty = value.module.api.getMarkerColors();
  assert.equal(empty.combatId, null);
  assert.equal(empty.markers.length, 0);
});

test('marker update hook follows changed broadcasts and exposes only public marker identity/color', () => {
  const value = arena();
  value.context.initializeChannel();
  value.context.broadcastState('initial');
  assert.equal(value.messages.length, 1);
  assert.equal(value.calls.length, 1);
  assert.equal(value.calls[0][0], 'combatWallMarkersUpdated');
  assert.deepEqual(value.eventOrder, ['broadcast', 'hook']);
  assert.equal(JSON.stringify(value.calls[0][1]), JSON.stringify(value.context.getMarkerColors(value.messages[0].payload)));
  value.context.broadcastState('unchanged');
  assert.equal(value.messages.length, 1);
  assert.equal(value.calls.length, 1);
  value.order.alpha.reverse();
  value.context.broadcastState('colors changed');
  assert.equal(value.messages.length, 2);
  assert.equal(value.calls.length, 2);
  assert.deepEqual(value.eventOrder, ['broadcast', 'hook', 'broadcast', 'hook']);
  assert.equal(JSON.stringify(value.calls[1][1]), JSON.stringify(value.context.getMarkerColors(value.messages[1].payload)));
});
