import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from contextlib import closing

spec = importlib.util.spec_from_file_location("export_sqlite", Path(__file__).with_name("export-sqlite.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ExportTests(unittest.TestCase):
    def test_readonly_exact_rounding_and_archive(self):
        with tempfile.TemporaryDirectory(prefix="dado-export-test-") as directory:
            root = Path(directory).resolve()
            source, target = root / "source.db", root / "snapshot.json"
            with closing(sqlite3.connect(source)) as db:
                db.executescript("CREATE TABLE jugadores(dni TEXT,nombres TEXT,total_ganado REAL);"
                                 "CREATE TABLE wallet(dni TEXT,saldo_real REAL,saldo_bono REAL,moneda_ingame INTEGER);"
                                 "INSERT INTO jugadores VALUES('12345678','Prueba',8.015);"
                                 "INSERT INTO wallet VALUES('12345678',1.005,0.295,2);")
            original = source.read_bytes()
            summary = module.export(source, target)
            self.assertEqual(summary["totals"], {"disponible_centimos": "101", "bono_centimos": "30"})
            snapshot = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(snapshot["player_stats"]["12345678"]["total_ganado_centimos"], "802")
            self.assertEqual(snapshot["archive"]["wallet"][0]["saldo_real"], 1.005)
            self.assertEqual(source.read_bytes(), original)
            with self.assertRaises(ValueError):
                module.export(source, target)

    def test_invalid_money(self):
        for value in (-1, "NaN", "Infinity", "92233720368547759"):
            with self.assertRaises(ValueError):
                module.centimos(value)

    def test_empty_orphan_preserved_without_fabricating_user(self):
        with tempfile.TemporaryDirectory(prefix="dado-orphan-test-") as directory:
            source, target = Path(directory) / "source.db", Path(directory) / "snapshot.json"
            with closing(sqlite3.connect(source)) as db:
                db.executescript("CREATE TABLE jugadores(dni TEXT,nombres TEXT,total_ganado REAL);"
                                 "CREATE TABLE wallet(dni TEXT,saldo_real REAL,saldo_bono REAL,moneda_ingame INTEGER);"
                                 "INSERT INTO wallet VALUES('12345678',0,0,0);")
            original = source.read_bytes()
            result = module.export(source, target)
            snapshot = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["billeteras_huerfanas_vacias_archivadas"], 1)
            self.assertEqual(snapshot["accounts"], [])
            self.assertEqual(len(snapshot["archive"]["wallet"]), 1)
            self.assertEqual(source.read_bytes(), original)

    def test_orphan_with_money_or_coins_requires_reconciliation(self):
        for field, value in (("saldo_real", 0.004), ("saldo_bono", 1), ("moneda_ingame", 1)):
            with self.subTest(field=field), tempfile.TemporaryDirectory(prefix="dado-orphan-test-") as directory:
                source, target = Path(directory) / "source.db", Path(directory) / "snapshot.json"
                with closing(sqlite3.connect(source)) as db:
                    db.executescript("CREATE TABLE jugadores(dni TEXT,nombres TEXT,total_ganado REAL);"
                                     "CREATE TABLE wallet(dni TEXT,saldo_real REAL,saldo_bono REAL,moneda_ingame INTEGER);"
                                     "INSERT INTO wallet VALUES('12345678',0,0,0);")
                    db.execute('UPDATE wallet SET ' + field + '=?', (value,))
                    db.commit()
                with self.assertRaisesRegex(ValueError, "conciliar"):
                    module.export(source, target)
                self.assertFalse(target.exists())

if __name__ == "__main__":
    unittest.main()
