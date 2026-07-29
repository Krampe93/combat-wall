const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dashboard = fs.readFileSync(path.join(root, "dashboard", "dashboard-0.9.1.js"), "utf8");
const dashboardCss = fs.readFileSync(path.join(root, "dashboard", "dashboard-0.9.1.css"), "utf8");
const index = fs.readFileSync(path.join(root, "dashboard", "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));

assert.equal(manifest.version, "0.9.1");
assert.deepEqual(manifest.esmodules, ["scripts/main-0.9.1.js"]);
assert.match(index, /dashboard-0\.9\.1\.css\?v=0\.9\.1/);
assert.match(index, /dashboard-0\.9\.1\.js\?v=0\.9\.1/);

assert.match(dashboard, /count\.hidden = group\.total <= 1/);
assert.match(dashboard, /group\.total > 1 \? `\$\{group\.living\}\/\$\{group\.total\} aktiv` : ""/);
assert.match(dashboard, /progress\.hidden = group\.total <= 1/);
assert.match(dashboard, /focusProgress\.hidden = activeGroup\.total <= 1/);

assert.match(dashboardCss, /\.member-segment\s*\{[^}]*border:\s*0;/s);
assert.doesNotMatch(dashboardCss, /\.member-segment\s*\{[^}]*border:\s*1px/s);
assert.match(dashboardCss, /\.member-segment\.active\s*\{[^}]*box-shadow:/s);
assert.match(dashboardCss, /\.position-marker\s*\{[^}]*background:\s*var\(--marker-color/s);

console.log("Combat Wall 0.9.1 UI patch checks passed.");
