// Numerical QA of every shipped take. No browser access or match results are changed.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {Vector3,Quaternion,PerspectiveCamera}=require('three');
function load(file,dependencies={}) {
 const filename=path.resolve(__dirname,file),mod=new Module(filename,module);
 mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const originalRequire=mod.require.bind(mod);mod.require=name=>dependencies[name]||originalRequire(name);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 return mod.exports;
}
const physics=load('../lib/arena/physics.ts');
const {flightCameraBounds,flightCameraPose}=load('../lib/arena/camera.ts',{'./physics':physics});
const takes=require('../lib/arena/takes.json'),scenarios=[];
for(const [number,choices] of Object.entries(takes))for(let take=0;take<choices.length;take++) {
 const count=Number(number),round={rolls:Array.from({length:count},(_,i)=>({playerId:'p'+i,value:i%6+1})),leaders:['p0']};
 let nonce=0,seed;do{seed='audit-'+count+'-'+take+'-'+nonce++;}while(Math.floor(physics.seededRandom(seed)()*choices.length)!==take);
 const start=performance.now(),flight=physics.simulateFlight(round,seed),preparationMs=performance.now()-start;
 const lastMoving=Array(count).fill(0),turns=Array(count).fill(0),qa=new Quaternion(),qb=new Quaternion();
 for(let k=1;k<flight.frames.length;k++)for(let i=0;i<count;i++) {
  const a=flight.frames[k-1],b=flight.frames[k],j=i*7;qa.fromArray(a,j+3).normalize();qb.fromArray(b,j+3).normalize();const angle=qa.angleTo(qb);
  turns[i]+=angle/(2*Math.PI);if(angle>.003||Math.hypot(a[j]-b[j],a[j+1]-b[j+1],a[j+2]-b[j+2])>.001)lastMoving[i]=k*flight.frameStep;
 }
 const bounds=flightCameraBounds(flight),cameras=[];
 for(const aspect of [.5,.8,1.8,2.5]) {
  const camera=new PerspectiveCamera(40,aspect,.1,100);let maxNdc=0;
  for(let k=0;k<flight.frames.length+30;k+=3) {
   const elapsed=k*flight.frameStep,pose=flightCameraPose(bounds,aspect,elapsed,flight.duration);
   camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
   const frame=flight.frames[Math.min(k,flight.frames.length-1)];
   for(let i=0;i<count;i++) {
    if(elapsed<flight.releases[i])continue;const j=i*7;qa.fromArray(frame,j+3).normalize();
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
     const p=new Vector3(x,y,z).multiplyScalar(physics.DIE_SIZE/2).applyQuaternion(qa).add(new Vector3().fromArray(frame,j)).project(camera);
     maxNdc=Math.max(maxNdc,Math.abs(p.x),Math.abs(p.y));if(p.z<=-1||p.z>=1)throw new Error('Camera depth clipping');
    }
   }
  }
  if(maxNdc>=.9)throw new Error('Camera clipping: '+count+'/'+take+'/'+aspect);
  cameras.push({aspect,maxNdc:+maxNdc.toFixed(4)});
 }
 if(Math.min(...lastMoving)<10||Math.min(...turns)<3)throw new Error('Short motion: '+count+'/'+take);
 scenarios.push({count,take:choices[take],seed,duration:flight.duration,preparationMs:+preparationMs.toFixed(2),diceContacts:flight.diceContacts,
  releases:flight.releases,lastMovingSeconds:lastMoving,turns,cameras});
}
const result={note:'Numerical projections, not browser captures or measured GPU FPS. Movement times begin at the first release, not each individual release.',scenarios};
fs.writeFileSync(path.resolve(__dirname,'arena-audit-results.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
