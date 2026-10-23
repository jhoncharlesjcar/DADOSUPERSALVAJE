import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requirePlayer } from "@/lib/playerAuth";
import { isOnlineModeEnabled } from "@/lib/onlineMode";
import { validateMatch, type ArenaMatch } from "@/lib/arena/types";

type RoomRow = { id: number; modo: string; monto: number; estado: string; jugadores_json: string };
type Roll = { dni: string; nombres: string; valor: number };

function readMembers(room: RoomRow): string[] {
  try {
    const value = JSON.parse(room.jugadores_json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getAuthorizedRoom(id: number, dni: string): { room: RoomRow; members: string[] } | null {
  const room = getDB().prepare("SELECT id, modo, monto, estado, jugadores_json FROM salas WHERE id = ?").get(id) as RoomRow | undefined;
  if (!room) return null;
  const members = readMembers(room);
  return members.includes(dni) ? { room, members } : null;
}

export async function GET(request: Request) {
  if (!isOnlineModeEnabled()) return NextResponse.json({ error: "Modo online temporalmente no disponible" }, { status: 503 });
  try {
    const dni = await requirePlayer();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Sala inválida" }, { status: 400 });

    const authorized = getAuthorizedRoom(id, dni);
    if (!authorized) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    const db = getDB();
    const placeholders = authorized.members.map(() => "?").join(",");
    const players = db.prepare(`SELECT dni, nombres FROM jugadores WHERE dni IN (${placeholders})`).all(...authorized.members) as Array<{ dni: string; nombres: string }>;
    const names = new Map(players.map(player => [player.dni, player.nombres]));
    const onlineGame = db.prepare("SELECT ganador_json, resultados_json, replay_json, estado FROM online_partidas WHERE sala_id = ?").get(id) as {
      ganador_json: string;
      resultados_json: string;
      replay_json: string | null;
      estado: string;
    } | undefined;
    const history = db.prepare("SELECT premio, pozo, rondas_empate FROM partidas WHERE external_id = ?").get(`online:${id}`) as {
      premio: number;
      pozo: number;
      rondas_empate: number;
    } | undefined;

    let rolls: Roll[] = [];
    let winner: Roll | null = null;
    let replay: ArenaMatch | null = null;
    try {
      if (onlineGame) {
        const parsedRolls = JSON.parse(onlineGame.resultados_json);
        rolls = Array.isArray(parsedRolls) ? parsedRolls : [];
        winner = JSON.parse(onlineGame.ganador_json);
        if (onlineGame.replay_json) {
          const saved = JSON.parse(onlineGame.replay_json) as ArenaMatch;
          if (validateMatch(saved)) {
            // Public replay uses stable room seats; never expose other players' DNIs.
            const seats = new Map(authorized.members.map((member, i) => [member, `seat-${i + 1}`]));
            replay = {
              ...saved,
              players: saved.players.map(p => ({ ...p, id: seats.get(p.id)! })),
              winnerId: seats.get(saved.winnerId)!,
              rounds: saved.rounds.map(round => ({
                rolls: round.rolls.map(roll => ({ ...roll, playerId: seats.get(roll.playerId)! })),
                leaders: round.leaders.map(leader => seats.get(leader)!),
              })),
            };
          }
        }
      }
    } catch {
      return NextResponse.json({ error: "El resultado de la sala está dañado" }, { status: 500 });
    }

    return NextResponse.json({
      replay,
      room: {
        id,
        mode: authorized.room.modo,
        stake: authorized.room.monto,
        status: onlineGame?.estado === "completada" ? "completed" : "waiting",
        players: authorized.members.map((memberDni, index) => ({
          seat: index + 1,
          name: names.get(memberDni) || "Jugador",
          isMe: memberDni === dni,
        })),
      },
      result: winner && history ? {
        winner: { seat: authorized.members.indexOf(winner.dni) + 1, name: winner.nombres, value: winner.valor, isMe: winner.dni === dni },
        rolls: rolls.map((roll, index) => ({ seat: index + 1, name: roll.nombres, value: roll.valor, isMe: roll.dni === dni })),
        prize: history.premio,
        pool: history.pozo,
        tiebreakRounds: history.rondas_empate,
      } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const dni = await requirePlayer();
    const id = Number((await request.json()).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Sala inválida" }, { status: 400 });
    if (!getAuthorizedRoom(id, dni)) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    getDB().prepare("INSERT OR IGNORE INTO online_room_views (sala_id, dni) VALUES (?, ?)").run(id, dni);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
