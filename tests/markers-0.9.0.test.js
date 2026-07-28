const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("scripts/main-0.9.0.js", "utf8");
const context = vm.createContext({
  console,
  Hooks: { once() {}, on() {} },
  window: {
    clearTimeout() {},
    setTimeout() {},
    location: { origin: "https://example.invalid" }
  },
  globalThis: {},
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

const scene = {
  documentName: "Scene",
  dimensions: {
    sceneRect: { x: 100, y: 200, width: 1000, height: 500 },
    size: 100
  }
};

const topRight = context.resolveMarkerPosition({
  parent: scene,
  x: 950,
  y: 200,
  width: 1,
  height: 1
});
assert.equal(topRight.source, "sceneRect");
assert.equal(topRight.normalizedX, 0.9);
assert.equal(topRight.normalizedY, 0.1);

const beyondEdge = context.resolveMarkerPosition({
  parent: scene,
  x: 5000,
  y: -5000,
  width: 1,
  height: 1
});
assert.equal(beyondEdge.normalizedX, 0.97);
assert.equal(beyondEdge.normalizedY, 0.03);

assert.equal(context.markerColorForIndex(0), "#37d5ff");
assert.equal(context.markerColorForIndex(1), "#ff4fd8");
assert.equal(context.markerColorForIndex(8), "#37d5ff");

console.log("Combat Wall 0.9.0 marker normalization checks passed.");
