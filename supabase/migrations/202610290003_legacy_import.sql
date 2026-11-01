-- Original SQLite records remain auditable and private, including history that cannot
-- truthfully be assigned a seed, identity verification or zero-sum modern ledger.
CREATE TABLE importaciones_legacy (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  fuente_sha256 text NOT NULL, manifiesto jsonb NOT NULL,
  disponible_centimos bigint NOT NULL, bono_centimos bigint NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE archivo_legacy (
  importacion_id text NOT NULL REFERENCES importaciones_legacy(id),
  tabla text NOT NULL, fila integer NOT NULL, datos jsonb NOT NULL,
  PRIMARY KEY(importacion_id,tabla,fila)
);
CREATE TRIGGER archivo_inmutable BEFORE UPDATE OR DELETE ON archivo_legacy FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_libro();
CREATE TRIGGER archivo_no_truncate BEFORE TRUNCATE ON archivo_legacy FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_libro();
ALTER TABLE importaciones_legacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivo_legacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON importaciones_legacy,archivo_legacy FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON importaciones_legacy,archivo_legacy FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON importaciones_legacy,archivo_legacy FROM authenticated; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT SELECT,INSERT ON importaciones_legacy,archivo_legacy TO service_role; END IF;
END $$;
