const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "scripts", "main-1.0.0.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "dashboard", "dashboard-1.0.0.js"), "utf8");
const css = fs.readFileSync(path.join(root, "dashboard", "dashboard-1.0.0.css"), "utf8");
const index = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));

assert.equal(manifest.version, "1.0.0");
assert.deepEqual(manifest.esmodules, ["scripts/main-1.0.0.js"]);
assert.match(index, /dashboard-1\.0\.0\.css\?v=1\.0\.0/);
assert.match(index, /dashboard-1\.0\.0\.js\?v=1\.0\.0/);
assert.match(main, /function serializeActiveEffects/);
assert.match(main, /function translateEffectName/);
assert.match(main, /function resolveBloodiedState/);
assert.match(main, /hpValue > 0 && hpValue <= threshold/);
assert.match(dashboard, /createEffectCard/);
assert.match(dashboard, /classList\.toggle\("bloodied"/);
assert.match(css, /\.focus-card\.bloodied/);
assert.match(css, /\.focus-effects/);
assert.match(css, /@keyframes focus-effect-enter/);
assert.match(css, /\.position-marker\.bloodied/);

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

console.log("Combat Wall 1.0.0 effects and bloodied checks passed.");
