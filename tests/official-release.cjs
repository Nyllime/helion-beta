const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.argv[2]||'.',html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
for(const filename of ['helion-workflow.js','install-shortcut.js'])new vm.Script(fs.readFileSync(path.join(root,filename),'utf8'));
assert.match(html,/<title>Helion — Versão oficial<\/title>/);
for(const name of ['renderAgendaVisitRoute','clientLinkedNotes','openRemoteSignatures','renderProjectFileLibrary','setupProjectAdjustments','pwCatalogSetup','projectAutoRestore','budgetFollowupDraft'])assert.ok(html.includes('function '+name+'('),'Preserved feature: '+name);
assert.ok(html.includes("db.rpc('helion_accounting_include'"));
const context={};vm.createContext(context);
for(const name of ['workspaceRound','workspaceLine','workspaceTotals']){const fn=html.split('\n').find(line=>line.startsWith('function '+name+'('));vm.runInContext(fn,context);}
const workspace={discount_percent:10,addition_percent:20,discount_amount:30,addition_amount:20,adjustment_scope:'all',items:[{quantity:2,unit_cost:40,unit_price:100}],extras:[{kind:'service',quantity:1,unit_cost:20,unit_price:100},{kind:'expense',quantity:1,unit_cost:10,unit_price:50}]};
assert.equal(context.workspaceTotals(workspace).total,368);assert.equal(context.workspaceTotals(workspace).cost,110);assert.equal(context.workspaceTotals({...workspace,adjustment_scope:'products'}).total,356);
vm.runInContext(html.slice(html.indexOf('function geoNumber('),html.indexOf('function geoFields(')),context);
assert.equal(context.geoPair('91','1'),null);assert.equal(context.geoPair('0','0').latitude,0);assert.equal(context.geoPair('-23,55','-46,63').longitude,-46.63);assert.match(context.geoMapsLink('-23.55','-46.63',''),/destination=-23.55%2C-46.63/);
console.log('PASS official release: syntax, retained modules, shared financial metadata RPC, full/project-only pricing and exact Maps coordinates.');
