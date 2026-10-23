import { simulateFlight } from "../lib/arena/physics";
for (const count of [2, 10]) {
  for (let seed = 0; seed < 12; seed++) {
    const flight = simulateFlight({ rolls: Array.from({length:count},(_,i)=>({playerId:`p${i}`,value:i%6+1})), leaders:["p0"] }, `physics-${count}-${seed}`);
    const turns = Array(count).fill(0);
    let lastMoving=0;
    for(let k=1;k<flight.frames.length;k++) {
      for(let i=0;i<count;i++) {
        const a=flight.frames[k-1],b=flight.frames[k],j=i*7;
        const dot=Math.abs(a[j+3]*b[j+3]+a[j+4]*b[j+4]+a[j+5]*b[j+5]+a[j+6]*b[j+6]);
        const angle=2*Math.acos(Math.min(1,dot));
        if (angle>.005 || Math.hypot(a[j]-b[j],a[j+1]-b[j+1],a[j+2]-b[j+2])>.003) lastMoving=k*flight.frameStep;
        turns[i]+=angle/(2*Math.PI);
      }
    }
    console.log(JSON.stringify({count,seed,duration:flight.duration,lastMoving,turns:turns.map(t=>+t.toFixed(1)),impacts:flight.impacts.length,diceContacts:flight.diceContacts}));
  }
}
