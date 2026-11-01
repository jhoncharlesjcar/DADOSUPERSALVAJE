// Offline search only. Never changes the shipped takes automatically.
// node tools/arena-calibrate.cjs <count|all> <seedLimit>
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Quaternion } = require('three');
const filename = path.resolve(__dirname, '../lib/arena/physics.ts');
const source = fs.readFileSync(filename, 'utf8') + '\nexport { simulateTake };';
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const mod = new Module(filename, module);
mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled,filename);
const output=path.resolve(__dirname,'arena-calibration.json');
const saved=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
const counts=process.argv[2] && process.argv[2]!=='all' ? [Number(process.argv[2])] : [2,3,4,5,6,7,8,9,10];
for(const count of counts) {
 if(!Number.isInteger(count)||count<2||count>10)throw new Error('Count must be 2–10');
 const entry={count,accepted:[],best:0,ms:0};
 const start=performance.now();
 for(let seed=0;seed<Number(process.argv[3]||500);seed++) {
  const takeSeed='calibration-'+count+'-'+seed;
  let flight;
  try {flight=mod.exports.simulateTake({rolls:Array.from({length:count},(_,i)=>({playerId:'p'+i,value:i%6+1})),leaders:['p0']},takeSeed);} catch {continue;}
  const last=Array(count).fill(0),turns=Array(count).fill(0),qa=new Quaternion(),qb=new Quaternion();
  for(let k=1;k<flight.frames.length;k++)for(let i=0;i<count;i++) {
   const a=flight.frames[k-1],b=flight.frames[k],j=i*7;
   qa.fromArray(a,j+3).normalize();qb.fromArray(b,j+3).normalize();const angle=qa.angleTo(qb);turns[i]+=angle/(2*Math.PI);
   if(angle>.003||Math.hypot(a[j]-b[j],a[j+1]-b[j+1],a[j+2]-b[j+2])>.001)last[i]=k*flight.frameStep;
  }
  const active=Math.min(...last);entry.best=Math.max(entry.best,active);
  if(active>=10&&Math.min(...turns)>=3&&flight.diceContacts>=Math.max(2,count-1)) {
   entry.accepted.push({seed,takeSeed,contacts:flight.diceContacts,last,releases:flight.releases,turns,active});
   entry.ms=Math.round(performance.now()-start);saved[count]=entry;fs.writeFileSync(output,JSON.stringify(saved,null,2));
   console.log('ACCEPTED',count,takeSeed);if(entry.accepted.length>=3)break;
  }
 }
 entry.ms=Math.round(performance.now()-start);saved[count]=entry;fs.writeFileSync(output,JSON.stringify(saved,null,2));console.log(JSON.stringify(entry));
}
