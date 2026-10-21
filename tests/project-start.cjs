const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('function beginProjectWithDetails('),end=source.indexOf('\nfunction prepareProjectWorkspace(',start);
const nodes=new Map(),buttons=new Map();let openings=0,focused='';
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,setAttribute(){},removeAttribute(){},focus(){focused=id;},replaceChildren(){this.innerHTML='';},click(){this.onclick();}});return nodes.get(id);}
const clients=[{id:'a',name:'Cliente Alfa',cpf_cnpj:'123',address:'Endereço cadastrado'},{id:'b',name:'Cliente Beta',cpf_cnpj:'456'}];
const context={state:{profile:{id:'seller'},clients},$:s=>node(s),$$:()=>{const ids=Array.from(node('#projectStartResults').innerHTML.matchAll(/data-project-start-client="([^"]+)"/g),m=>m[1]);return ids.map(id=>{if(!buttons.has(id))buttons.set(id,{dataset:{projectStartClient:id},classList:{toggle(){}}});return buttons.get(id);});},showModal(){},modalHead(){return'';},employeeOptions(){return'';},esc:s=>String(s||''),posClientCode:c=>c.id,hasFeature(){return true;},projectWorkspaceEntry(){openings++;},pwClientInfo(){},prepareProjectWorkspace(){}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
context.beginProjectWithDetails(['project']);
assert.equal(node('#projectStartResults').innerHTML,'');assert.equal(node('#projectStartResults').hidden,true);
node('#projectStartSearch').value='Alfa';node('#projectStartSearch').oninput();assert.match(node('#projectStartResults').innerHTML,/Cliente Alfa/);assert.doesNotMatch(node('#projectStartResults').innerHTML,/Cliente Beta/);
buttons.get('a').onclick();node('#projectStartAddress').value='Local informado pelo usuário';
node('#projectStartClear').click();assert.equal(openings,0);assert.equal(focused,'#projectStartName');assert.match(node('#projectStartStatus').textContent,/cliente é opcional/);assert.equal(node('#projectStartResults').hidden,true);
node('#projectStartName').value='Projeto sem cliente';node('#projectStartClear').click();assert.equal(openings,1);assert.equal(node('#pwClient').value,'');assert.equal(node('#pwName').value,'Projeto sem cliente');assert.equal(node('#pwAddress').value,'Local informado pelo usuário');
console.log('PASS project entry: clients only after search, matching results, required-name feedback, skip-client advances and project details are retained.');
