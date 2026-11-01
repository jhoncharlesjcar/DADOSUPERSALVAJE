// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { resolveArena } from "../lib/resolveArena";
import { latestRolls, validateMatch } from "../lib/arena/types";
import { simulateFlight, FACE_NORMALS, FACE_VALUES } from "../lib/arena/physics";

const players = Array.from({length:10},(_,i)=>({id:`p${i}`,name:`Player ${i}`,dadoId:"rojo"}));
describe("resolución autoritativa",()=>{
  it("elimina al tercero y resuelve solo a los empatados, aunque el último valor sea menor",()=>{
    const values=[6,6,5,1,2];
    const match=resolveArena("test",players.slice(0,3),()=>values.shift()!);
    expect(match.rounds).toHaveLength(2);expect(match.rounds[1].rolls.map(r=>r.playerId)).toEqual(["p0","p1"]);
    expect(match.winnerId).toBe("p1");expect(latestRolls(match).map(r=>r.value)).toEqual([1,2,5]);
    expect(validateMatch(match)).toBe(true);
    expect(validateMatch({...match,winnerId:"p2"})).toBe(false);
  });
  it("rechaza tiradas fuera de rango y partidas sin resolución",()=>{
    expect(()=>resolveArena("bad",players.slice(0,2),()=>0)).toThrow();
    expect(()=>resolveArena("tie",players.slice(0,2),()=>6)).toThrow();
  });
});
describe("contactos de dados y caras",()=>{
  for(const count of [2,3,4,5,6,7,8,9,10]) {
    it(`asienta ${count} dados dentro de la mesa con sus caras confirmadas`,()=>{
      for(let seed=0;seed<12;seed++) {
        const round={rolls:players.slice(0,count).map((p,i)=>({playerId:p.id,value:(i+seed)%6+1})),leaders:["p0"]};
        const flight=simulateFlight(round,`physics-${count}-${seed}`);
        const end=flight.frames.at(-1)!, previous=flight.frames.at(-2)!;
        expect(flight.duration).toBeGreaterThanOrEqual(10);
        expect(flight.duration).toBeLessThanOrEqual(15);
        expect(flight.frameStep * (flight.frames.length - 1)).toBeCloseTo(flight.duration);
        expect(flight.diceContacts).toBeGreaterThan(0);
        expect(flight.impacts.every(impact => impact.time >= 0 && impact.time <= flight.duration)).toBe(true);
        const lastMoving = Array(count).fill(0);
        const turns = Array(count).fill(0);
        for(let frame=1; frame<flight.frames.length; frame++) {
          const a=flight.frames[frame-1],b=flight.frames[frame];
          for(let i=0;i<count;i++) {
            const j=i*7;
            const angle=new Quaternion().fromArray(a,j+3).normalize().angleTo(new Quaternion().fromArray(b,j+3).normalize());
            turns[i]+=angle/(2*Math.PI);
            if(angle>.003 || Math.hypot(a[j]-b[j],a[j+1]-b[j+1],a[j+2]-b[j+2])>.001) lastMoving[i]=frame*flight.frameStep;
          }
        }
        expect(Math.max(...lastMoving), `no long frozen hold seed ${seed}`).toBeGreaterThan(flight.duration-1.2);
        expect(Math.min(...lastMoving), `each die still moves beyond second 10, seed ${seed}`).toBeGreaterThanOrEqual(10);
        expect(Math.min(...turns), `multiple rotations seed ${seed}`).toBeGreaterThan(3);
        for(let i=0;i<count;i++) {
          const j=i*7;
          expect([...end.slice(j,j+7)].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(end[j],end[j+2])).toBeLessThan(8.2);
          expect(end[j+1]).toBeGreaterThan(0.4);
          expect.soft(end[j+1], `height seed ${seed} die ${i}`).toBeLessThan(0.55);
          expect(Math.abs(end[j]-previous[j])+Math.abs(end[j+2]-previous[j+2])).toBeLessThan(0.001);
          const normal=FACE_NORMALS[FACE_VALUES.indexOf(round.rolls[i].value)];
          const q=new Quaternion(end[j+3],end[j+4],end[j+5],end[j+6]).multiply(new Quaternion(...flight.offsets[i]));
          expect.soft(new Vector3(...normal).applyQuaternion(q).y, `up seed ${seed} die ${i}`).toBeGreaterThan(0.99);
        }
      }
    },20000);
  }
  it("repetir una escena conserva la trayectoria completa",()=>{
    const round={rolls:[{playerId:"p0",value:1},{playerId:"p1",value:6}],leaders:["p1"]};
    const a=simulateFlight(round,"same"),b=simulateFlight(round,"same");
    expect(a.frames).toEqual(b.frames);expect(a.offsets).toEqual(b.offsets);
  });
});
