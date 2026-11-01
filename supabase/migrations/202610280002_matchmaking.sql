-- PostgreSQL is the durable queue; Redis is an expendable rating index.
CREATE TABLE queue_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 modo text NOT NULL CHECK (modo IN ('duelo','batalla','equipos_3v3','equipos_4v4','equipos_5v5')),
 monto_centimos bigint NOT NULL CHECK (monto_centimos IN (200,500,1000,2000,3000,4000,5000,10000)),
 demo boolean NOT NULL,
 grupo_id uuid REFERENCES equipos(id),
 rating_promedio double precision NOT NULL,
 estado text NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando','asignado','retirado')),
 partida_id uuid REFERENCES partidas(id),
 joined_at timestamptz NOT NULL DEFAULT now(),
 disponible_desde timestamptz NOT NULL DEFAULT now(),
 prioridad boolean NOT NULL DEFAULT false
);
CREATE TABLE queue_members (
 unidad_id uuid NOT NULL REFERENCES queue_units(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),
 rating int NOT NULL,
 dado_id text NOT NULL REFERENCES dados(id),
 activo boolean NOT NULL DEFAULT true,
 PRIMARY KEY(unidad_id,usuario_id)
);
CREATE UNIQUE INDEX queue_one_active_membership ON queue_members(usuario_id) WHERE activo;
CREATE INDEX queue_find_candidates ON queue_units(modo,monto_centimos,demo,estado,disponible_desde,joined_at);
ALTER TABLE partidas ADD COLUMN confirmacion_hasta timestamptz;
CREATE TABLE queue_penalties (usuario_id uuid PRIMARY KEY REFERENCES usuarios(id), hasta timestamptz NOT NULL);
CREATE TABLE online_room_views (
 partida_id uuid NOT NULL REFERENCES partidas(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),
 visto_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(partida_id,usuario_id)
);
ALTER TABLE queue_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_room_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_penalties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON queue_units,queue_members,online_room_views,queue_penalties FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON queue_units,queue_members,online_room_views,queue_penalties FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON queue_units,queue_members,online_room_views,queue_penalties FROM authenticated;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON queue_units,queue_members,online_room_views,queue_penalties TO service_role;
 END IF;
END $$;
