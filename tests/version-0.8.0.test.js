const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "scripts", "main-0.8.0.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "dashboard", "dashboard-0.8.0.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");

assert.equal(manifest.version, "0.8.0");
assert.deepEqual(manifest.esmodules, ["scripts/main-0.8.0.js"]);
assert.match(manifest.download, /v0\.8\.0\/combat-wall-0\.8\.0\.zip$/);
assert.match(html, /dashboard-0\.8\.0\.css\?v=0\.8\.0/);
assert.match(html, /dashboard-0\.8\.0\.js\?v=0\.8\.0/);

assert.match(main, /PLAYER_IMAGE_SETTING = "playerFocusImages"/);
assert.match(main, /inspectPlayerImages/);
assert.match(main, /activeEntityType/);
assert.match(main, /enemySideGroupsLeft/);
assert.match(main, /focusModeVariant/);

assert.match(dashboard, /focus-player/);
assert.match(dashboard, /focus-enemy/);
assert.match(dashboard, /createPlayerFocusCard/);
assert.match(dashboard, /subtitle\.textContent = "Spielerzug"/);
assert.doesNotMatch(dashboard, /layoutMode = "overview"/);

console.log("Combat Wall 0.8.0 focus-mode checks passed.");
