"""Read-only legacy snapshot. Private output includes PIN hashes and must never be committed."""
import argparse
import hashlib
import json
import sqlite3
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from contextlib import closing

def centimos(value):
    number = Decimal(str(value if value is not None else 0))
    if not number.is_finite() or number < 0:
        raise ValueError("Saldo inválido en origen")
    result = int((number * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if result > 9223372036854775807:
        raise ValueError("Saldo fuera del rango PostgreSQL bigint")
    return str(result)

def export(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file() or source == destination or destination.exists():
        raise ValueError("Origen inexistente o destino existente/no seguro")
    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        tables = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        archive = {table: [dict(row) for row in db.execute('SELECT * FROM "' + table.replace('"', '""') + '"')] for table in tables}
        players = archive.get("jugadores", [])
        # Preserve the exact original rows in archive; normalized stats travel separately.
        player_stats = {str(p["dni"]): {"total_ganado_centimos": centimos(p.get("total_ganado"))} for p in players}
        wallets = {str(row["dni"]): row for row in archive.get("wallet", [])}
        if len(wallets) != len(archive.get("wallet", [])):
            raise ValueError("Billeteras duplicadas")
        orphan_ids = set(wallets) - {str(p["dni"]) for p in players}
        for orphan_id in orphan_ids:
            # Keep empty orphan rows in the immutable archive, without inventing an
            # account owner. Any amount, including sub-cent money, requires reconciliation.
            orphan = wallets[orphan_id]
            for field in ("saldo_real", "saldo_bono", "moneda_ingame"):
                amount = Decimal(str(orphan.get(field) or 0))
                if not amount.is_finite() or amount != 0:
                    raise ValueError("Billetera sin jugador con saldo: conciliar origen")
        accounts = []
        for player in players:
            dni = str(player["dni"])
            wallet = wallets.get(dni)
            if wallet is None:
                raise ValueError("Falta billetera: conciliar origen antes de exportar")
            accounts.append({"dni": dni, "disponible_centimos": centimos(wallet.get("saldo_real")),
                             "bono_centimos": centimos(wallet.get("saldo_bono")),
                             "moneda_ingame": int(wallet.get("moneda_ingame") or 0)})
        data = {"version": 1, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "archive": archive, "accounts": accounts, "player_stats": player_stats,
                "totals": {"disponible_centimos": str(sum(int(a["disponible_centimos"]) for a in accounts)),
                           "bono_centimos": str(sum(int(a["bono_centimos"]) for a in accounts))}}
        db.rollback()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
    return {"jugadores": len(accounts), "tablas": len(tables), "totals": data["totals"],
            "billeteras_huerfanas_vacias_archivadas": len(orphan_ids)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("destination", help="Usa .local-migration/snapshot.json (ignorado por Git)")
    args = parser.parse_args()
    print(json.dumps(export(args.source, args.destination)))
