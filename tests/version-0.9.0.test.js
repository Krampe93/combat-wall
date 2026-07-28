const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "scripts", "main-0.9.0.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "dashboard", "dashboard-0.9.0.js"), "utf8");
const dashboardCss = fs.readFileSync(path.join(root, "dashboard", "dashboard-0.9.0.css"), "utf8");
const dashboardHtml = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");
const html = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");

assert.equal(manifest.version, "0.9.0");
assert.deepEqual(manifest.esmodules, ["scripts/main-0.9.0.js"]);
assert.match(manifest.download, /v0\.9\.0\/combat-wall-0\.9\.0\.zip$/);
assert.match(html, /dashboard-0\.9\.0\.css\?v=0\.9\.0/);
assert.match(html, /dashboard-0\.9\.0\.js\?v=0\.9\.0/);

assert.match(main, /PLAYER_IMAGE_SETTING = "playerFocusImages"/);
assert.match(main, /inspectPlayerImages/);
assert.match(main, /activeEntityType/);
assert.match(main, /enemySideGroupsLeft/);
assert.match(main, /getMarkerData/);
assert.match(main, /getGroupMarkerData/);
assert.match(main, /inspectMarkers/);
assert.match(main, /resolveMarkerPosition/);
assert.doesNotMatch(main, /resolveDirection/);

assert.match(dashboard, /focus-player/);
assert.match(dashboard, /focus-enemy/);
assert.match(dashboard, /rotateFromActive/);
assert.match(dashboard, /position-marker-layer/);
assert.doesNotMatch(dashboard, /createDirectionIndicator/);
assert.match(dashboardCss, /\.initiative-entry\.active/);
assert.match(dashboardCss, /\.position-marker\.active/);
assert.doesNotMatch(dashboardHtml, /current-panel/);
assert.match(dashboardHtml, /dashboard-0\.9\.0\.js\?v=0\.9\.0/);
assert.match(dashboard, /createPlayerFocusCard/);
assert.match(dashboard, /subtitle\.textContent = "Spielerzug"/);
assert.doesNotMatch(dashboard, /layoutMode = "overview"/);

console.log("Combat Wall 0.9.0 marker and initiative checks passed.");
