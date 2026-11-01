import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ThreeJsDiceEmbed from "../app/_components/ThreeJsDiceEmbed";

const mocks = vi.hoisted(() => ({ simulate: vi.fn(), render: vi.fn(), dispose: vi.fn(), quality: vi.fn() }));
vi.mock("../lib/arena/physics", () => ({ FLIGHT_START:2.65, simulateFlight:mocks.simulate }));
vi.mock("../lib/arena/scene", () => ({createArenaScene: () => ({canvas:document.createElement("canvas"),render:mocks.render,dispose:mocks.dispose,setQuality:mocks.quality})}));
let now = 0, id = 0;
let queue = new Map<number, FrameRequestCallback>();
const round = {rolls:[{playerId:"a",value:6},{playerId:"b",value:1}],leaders:["a"]};
const players = [{id:"a",name:"Ana",dadoId:"rojo"},{id:"b",name:"Bea",dadoId:"azul"}];
const props = { round, players, seed:"quality", quality:"medium" as const, paused:false,skip:false,onComplete:vi.fn(),onError:vi.fn(),onPhase:vi.fn(),onImpact:vi.fn() };
function frame(time: number) { act(() => { now=time; const pending=[...queue.values()]; queue.clear(); pending.forEach(fn=>fn(time)); }); }
beforeEach(() => {
  vi.clearAllMocks(); now=0;id=0;queue=new Map();
  mocks.simulate.mockReturnValue({duration:12,impacts:[]});
  vi.spyOn(performance,"now").mockImplementation(()=>now);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {queue.set(++id,fn);return id;});
  vi.stubGlobal("cancelAnimationFrame", (key:number) => queue.delete(key));
  vi.stubGlobal("matchMedia", () => ({matches:false}));
  Object.defineProperty(document,"hidden",{configurable:true,value:false});
});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it("cambiar calidad conserva la trayectoria, el instante y el resultado", () => {
  const view = render(<ThreeJsDiceEmbed {...props}/>);
  frame(0); frame(4000);
  expect(mocks.render).toHaveBeenLastCalledWith(4);
  view.rerender(<ThreeJsDiceEmbed {...props} quality="low"/>);
  expect(mocks.quality).toHaveBeenLastCalledWith("low");
  expect(mocks.simulate).toHaveBeenCalledTimes(1);
  expect(mocks.dispose).not.toHaveBeenCalled();
  frame(5000); expect(mocks.render).toHaveBeenLastCalledWith(5);
  frame(16000); expect(props.onComplete).toHaveBeenCalledTimes(1);
  view.rerender(<ThreeJsDiceEmbed {...props} quality="high"/>);
  expect(props.onComplete).toHaveBeenCalledTimes(1);
  expect(mocks.simulate).toHaveBeenCalledTimes(1);
});

it("reanuda una pestaña oculta sin saltar el tiempo oculto", () => {
  render(<ThreeJsDiceEmbed {...props}/>); frame(0);frame(3000);
  act(()=>{now=3500;Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  act(()=>{now=20000;Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  frame(21000);expect(mocks.render).toHaveBeenLastCalledWith(4.5);
  expect(props.onComplete).not.toHaveBeenCalled();
});

it("pausar y cambiar calidad no consume el tiempo de pausa", () => {
  const view=render(<ThreeJsDiceEmbed {...props}/>);frame(0);frame(3000);
  view.rerender(<ThreeJsDiceEmbed {...props} paused/>);
  frame(10000);
  view.rerender(<ThreeJsDiceEmbed {...props} paused quality="low"/>);
  view.rerender(<ThreeJsDiceEmbed {...props} quality="low"/>);
  frame(11000);expect(mocks.render).toHaveBeenLastCalledWith(4);
});
