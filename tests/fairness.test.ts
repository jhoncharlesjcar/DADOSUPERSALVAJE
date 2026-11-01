// @vitest-environment node
import { describe,it,expect } from "vitest";
import { createHash,createHmac } from "node:crypto";
import { createSeedCommitment,deriveDie,committedReplay,committedTeamReplay,verifyReplay } from "../lib/data/fairness";
import { cents,splitPot,solesToCents } from "../lib/data/money";
describe("céntimos exactos",()=>{
 it("incluye pozos impares y residuos de equipos",()=>{
  expect(splitPot(101n)).toEqual({house:16n,ranking:4n,prize:81n,each:81n});
  expect(splitPot(101n,5)).toEqual({house:17n,ranking:4n,prize:80n,each:16n});
  for(let n=1n;n<1000n;n++) for(let team=1;team<=5;team++) { const s=splitPot(n,team);expect(s.house+s.ranking+s.prize).toBe(n);expect(s.each*BigInt(team)).toBe(s.prize); }
 });
 it("rechaza floats, formatos ambiguos y overflow incluyendo bigint",()=>{
  expect(solesToCents("0.29")).toBe(29n);expect(()=>cents(29)).toThrow();expect(()=>cents(2n**63n)).toThrow();expect(()=>solesToCents("1e2")).toThrow();
 });
});
describe("protocolo HMAC v1",()=>{
 const players=["a","b","c"].map(id=>({id,name:id,dadoId:"rojo"}));
 it("es interoperable con HMAC y hash independientes",()=>{
  const {seed,hash}=createSeedCommitment();
  expect(hash).toBe(createHash("sha256").update(seed).digest("hex"));
  const word=createHmac("sha256",seed).update(JSON.stringify(["dado-salvaje-v1","match","player",1,0])).digest().readUInt32BE(0);
  if(word<4294967292) expect(deriveDie(seed,"match","player",1)).toBe(word%6+1);
 });
 it("los cosméticos no afectan resultados y detecta manipulación",()=>{
  const {seed,hash}=createSeedCommitment(),a=committedReplay("x",players,seed);
  const b=committedReplay("x",players.map(p=>({...p,dadoId:"azul"})),seed);
  expect(a.rounds).toEqual(b.rounds);expect(verifyReplay(hash,seed,a)).toBe(true);
  expect(verifyReplay(hash,"0".repeat(64),a)).toBe(false);
  const tampered=structuredClone(a);tampered.rounds[0].rolls[0].value=7;
  expect(verifyReplay(hash,seed,tampered)).toBe(false);
 });
 it("reproduce desempates multirronda solo con líderes",()=>{
  let found=false;
  for(let i=0;i<300 && !found;i++) {
   const seed=i.toString(16).padStart(64,"0"),match=committedReplay("x",players,seed);
   if(match.rounds.length<3) continue;
   for(let j=1;j<match.rounds.length;j++) expect(match.rounds[j].rolls.map(r=>r.playerId)).toEqual(match.rounds[j-1].leaders);
   expect(verifyReplay(createHash("sha256").update(seed).digest("hex"),seed,match)).toBe(true);found=true;
  }
  expect(found).toBe(true);
 });
 it("verifica equipos con suma de dados y ganador colectivo",()=>{
  const {seed,hash}=createSeedCommitment();
  const roster=Array.from({length:6},(_,i)=>({id:String(i),name:String(i),dadoId:"rojo",team:(i<3?"A":"B") as "A"|"B"}));
  const replay=committedTeamReplay("teams",roster,seed);
  expect(verifyReplay(hash,seed,replay)).toBe(true);expect(["A","B"]).toContain(replay.winnerTeam);
 });
});
