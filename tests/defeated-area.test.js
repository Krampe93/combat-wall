const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../dashboard/dashboard-1.1.0.js'), 'utf8');
const functions = source.slice(source.indexOf('  function defeatedRatio('), source.indexOf('  function createGroupCard('));
const context = vm.createContext({ document: { createElement() { return { style: {}, setAttribute() {} }; } } });
vm.runInContext(functions, context);
for (const [dead, total] of [[0,1],[1,1],[1,2],[2,2],[1,3],[2,3],[3,3],[1,4],[2,4],[3,4],[4,4],[2,8],[5,8]]) {
  for (const group of [{total, defeated:dead}, {totalMembers:total, activeMembers:total-dead}, {total, living:total-dead}]) {
    assert.equal(context.defeatedRatio(group), dead/total);
    const area = context.createDefeatedArea(group);
    assert.equal(parseFloat(area.style.width), dead/total*100);
    assert.equal(area.hidden, dead===0);
    context.updateDefeatedArea({querySelector:()=>area}, {total, defeated:0});
    assert.equal(area.hidden, true);
  }
}
for (const group of [{total:0}, {total:NaN}, {total:2,defeated:-1}]) assert.equal(context.defeatedRatio(group),0);
assert.equal(context.defeatedRatio({total:2,defeated:5}),1);
console.log('Proportional defeated area: all requested fractions and live updates passed.');
