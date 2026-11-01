-- Legacy timers used performance.now() and can contain fractional milliseconds.
-- Round only the compatibility projection; preserve exact source JSON in archivo_legacy.
CREATE OR REPLACE VIEW historial_partidas_legacy WITH (security_invoker=true) AS
SELECT a.importacion_id || ':' || a.fila::text AS id,
  COALESCE(a.datos->>'modo','normal') AS modo,
  round(COALESCE((a.datos->>'monto')::numeric,0)*100)::bigint AS monto_centimos,
  round(COALESCE((a.datos->>'pozo')::numeric,0)*100)::bigint AS pozo_centimos,
  round(COALESCE((a.datos->>'premio')::numeric,0)*100)::bigint AS premio_centimos,
  COALESCE(a.datos->>'ganador_dni','') AS ganador_dni,
  COALESCE(a.datos->>'ganador_nombre','') AS ganador_nombre,
  COALESCE((a.datos->>'jugadores_json')::jsonb,'[]'::jsonb) AS jugadores,
  COALESCE((a.datos->>'resultados_json')::jsonb,'[]'::jsonb) AS resultados,
  round(COALESCE((a.datos->>'duracion_ms')::numeric,0))::int AS duracion_ms,
  COALESCE((a.datos->>'hubo_empate')::int,0) AS hubo_empate,
  COALESCE((a.datos->>'rondas_empate')::int,0) AS rondas_empate,
  COALESCE((a.datos->>'fecha')::timestamp AT TIME ZONE 'UTC',i.creado_en) AS fecha,
  (i.manifiesto->>'demo')::boolean AS demo
FROM archivo_legacy a JOIN importaciones_legacy i ON i.id=a.importacion_id WHERE a.tabla='partidas';
REVOKE ALL ON historial_partidas_legacy FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON historial_partidas_legacy FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON historial_partidas_legacy FROM authenticated; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT SELECT ON historial_partidas_legacy TO service_role; END IF;
END $$;
