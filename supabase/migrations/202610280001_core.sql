-- Dado Salvaje: PostgreSQL is the sole source of truth. Amounts are PEN cents.
-- Apply using the migration owner, never from a browser connection.
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text UNIQUE NOT NULL CHECK (dni ~ '^[0-9]{8}$'),
  nombres text NOT NULL, celular text,
  fecha_nacimiento date,
  estado_identidad text NOT NULL DEFAULT 'pendiente' CHECK (estado_identidad IN ('pendiente','verificado','rechazado')),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','bloqueado','autoexcluido')),
  autoexcluido_hasta timestamptz, pin_hash text,
  rating integer NOT NULL DEFAULT 1200,
  puntos integer NOT NULL DEFAULT 0 CHECK (puntos >= 0),
  partidas_jugadas integer NOT NULL DEFAULT 0 CHECK (partidas_jugadas >= 0),
  partidas_ganadas integer NOT NULL DEFAULT 0 CHECK (partidas_ganadas >= 0),
  total_ganado_centimos bigint NOT NULL DEFAULT 0 CHECK (total_ganado_centimos >= 0),
  racha_actual integer NOT NULL DEFAULT 0 CHECK (racha_actual >= 0),
  mejor_racha integer NOT NULL DEFAULT 0 CHECK (mejor_racha >= 0),
  titulo text NOT NULL DEFAULT '', creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ratings (
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  modo text NOT NULL CHECK (modo IN ('duelo','batalla','equipos_3v3','equipos_4v4','equipos_5v5')),
  rating integer NOT NULL DEFAULT 1200, PRIMARY KEY(usuario_id,modo)
);
CREATE TABLE billeteras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  sistema text CHECK (sistema IN ('CASA','FONDO_RANKING')),
  demo boolean NOT NULL DEFAULT true,
  disponible_centimos bigint NOT NULL DEFAULT 0 CHECK (disponible_centimos >= 0),
  bloqueado_centimos bigint NOT NULL DEFAULT 0 CHECK (bloqueado_centimos >= 0),
  bono_centimos bigint NOT NULL DEFAULT 0 CHECK (bono_centimos >= 0),
  moneda_ingame integer NOT NULL DEFAULT 0 CHECK (moneda_ingame >= 0),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK ((usuario_id IS NOT NULL) <> (sistema IS NOT NULL)),
  UNIQUE(usuario_id,demo), UNIQUE(sistema,demo)
);
INSERT INTO billeteras(sistema,demo) VALUES ('CASA',true),('FONDO_RANKING',true),('CASA',false),('FONDO_RANKING',false);
CREATE TABLE equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text NOT NULL,
  lider_usuario_id uuid NOT NULL REFERENCES usuarios(id), creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE equipo_miembros (
  equipo_id uuid NOT NULL REFERENCES equipos(id), usuario_id uuid NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY(equipo_id,usuario_id)
);
CREATE TABLE limites_usuario (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id),
  recarga_diaria_centimos bigint CHECK (recarga_diaria_centimos >= 0),
  perdida_diaria_centimos bigint CHECK (perdida_diaria_centimos >= 0),
  retiro_diario_centimos bigint CHECK (retiro_diario_centimos >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dados (
  id text PRIMARY KEY, nombre text NOT NULL, color_hex text NOT NULL,
  rareza text, modelo_3d text NOT NULL, imagen text NOT NULL, activo boolean NOT NULL DEFAULT true
);
INSERT INTO dados(id,nombre,color_hex,modelo_3d,imagen) VALUES
 ('rojo','Demonio Salvaje','#FF3B3B','/models/mascots/demonio.glb','/dados/rojo.webp'),
 ('rosado','Pantera Rosada','#FF66B2','/models/mascots/pantera.glb','/dados/rosado.webp'),
 ('amarillo','Pato Salvaje','#FFD700','/models/mascots/pato.glb','/dados/amarillo.webp'),
 ('celeste','Titán del Océano','#00BFFF','/models/mascots/oceano.glb','/dados/celeste.webp'),
 ('blanco','La Fantasma','#FFFFFF','/models/mascots/fantasma.glb','/dados/blanco.webp'),
 ('negro','La Sombra','#333333','/models/mascots/sombra.glb','/dados/negro.webp'),
 ('verde','El Rey Salvaje','#00E676','/models/mascots/rey_salvaje.glb','/dados/verde.webp'),
 ('guinda','Emperador del Viento','#A80038','/models/mascots/emperador_viento.glb','/dados/guinda.webp'),
 ('naranja','Bestia de Fuego','#FF9100','/models/mascots/bestia_fuego.glb','/dados/naranja.webp'),
 ('azul','Poseidón','#2962FF','/models/mascots/poseidon.glb','/dados/azul.webp');
CREATE TABLE caras_dado (
  dado_id text NOT NULL REFERENCES dados(id), cara smallint NOT NULL CHECK (cara BETWEEN 1 AND 6),
  valor smallint NOT NULL CHECK (valor BETWEEN 1 AND 6), PRIMARY KEY(dado_id,cara),
  UNIQUE(dado_id,valor)
);
INSERT INTO caras_dado SELECT d.id,n,n FROM dados d CROSS JOIN generate_series(1,6) n;

CREATE TABLE partidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id text UNIQUE,
  modo text NOT NULL CHECK (modo IN ('duelo','batalla','equipos_3v3','equipos_4v4','equipos_5v5')),
  demo boolean NOT NULL DEFAULT true,
  monto_entrada_centimos bigint NOT NULL CHECK (monto_entrada_centimos IN (200,500,1000,2000,3000,4000,5000,10000)),
  min_jugadores integer CHECK (min_jugadores BETWEEN 2 AND 10),
  max_jugadores integer NOT NULL CHECK (max_jugadores BETWEEN 2 AND 10),
  CHECK (min_jugadores IS NULL OR min_jugadores <= max_jugadores),
  estado text NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando','confirmando','en_curso','en_desempate','finalizada','anulada','en_disputa')),
  pozo_centimos bigint NOT NULL DEFAULT 0 CHECK (pozo_centimos >= 0),
  comision_casa_centimos bigint NOT NULL DEFAULT 0 CHECK (comision_casa_centimos >= 0),
  fondo_ranking_centimos bigint NOT NULL DEFAULT 0 CHECK (fondo_ranking_centimos >= 0),
  premio_centimos bigint NOT NULL DEFAULT 0 CHECK (premio_centimos >= 0),
  ganador_usuario_id uuid REFERENCES usuarios(id), ganador_equipo text CHECK (ganador_equipo IN ('A','B')),
  hash_semilla text CHECK (hash_semilla ~ '^[a-f0-9]{64}$'), semilla_revelada text,
  replay jsonb, creada_en timestamptz NOT NULL DEFAULT now(), iniciada_en timestamptz,
  finalizada_en timestamptz, duracion_ms integer NOT NULL DEFAULT 0 CHECK (duracion_ms >= 0)
);
CREATE TABLE participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partida_id uuid NOT NULL REFERENCES partidas(id),
  usuario_id uuid NOT NULL REFERENCES usuarios(id), equipo text CHECK (equipo IN ('A','B')),
  dado_id text NOT NULL REFERENCES dados(id), apuesta_centimos bigint NOT NULL CHECK (apuesta_centimos > 0),
  confirmado boolean NOT NULL DEFAULT false, posicion integer,
  premio_centimos bigint NOT NULL DEFAULT 0 CHECK (premio_centimos >= 0),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','desconectado','abandono')),
  desconectado_en timestamptz, UNIQUE(partida_id,usuario_id), UNIQUE(id,partida_id)
);
CREATE TABLE tiradas (
  id bigserial PRIMARY KEY, partida_id uuid NOT NULL REFERENCES partidas(id),
  participante_id uuid NOT NULL,
  ronda integer NOT NULL CHECK (ronda >= 1), valor smallint NOT NULL CHECK (valor BETWEEN 1 AND 6),
  creada_en timestamptz NOT NULL DEFAULT now(), UNIQUE(participante_id,ronda),
  FOREIGN KEY(participante_id,partida_id) REFERENCES participantes(id,partida_id)
);
CREATE TABLE semillas_partida (
  partida_id uuid PRIMARY KEY REFERENCES partidas(id), semilla_servidor text NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE movimientos (
  id bigserial PRIMARY KEY, billetera_id uuid NOT NULL REFERENCES billeteras(id),
  tipo text NOT NULL CHECK (tipo IN ('recarga','apuesta_bloqueo','apuesta_liberacion','apuesta_cobro','premio','comision_casa','fondo_ranking','devolucion','retiro','ajuste_admin')),
  monto_centimos bigint NOT NULL,
  disponible_delta bigint NOT NULL, bloqueado_delta bigint NOT NULL DEFAULT 0, bono_delta bigint NOT NULL DEFAULT 0,
  saldo_disponible_despues bigint NOT NULL CHECK (saldo_disponible_despues >= 0),
  saldo_bloqueado_despues bigint NOT NULL CHECK (saldo_bloqueado_despues >= 0),
  saldo_bono_despues bigint NOT NULL DEFAULT 0 CHECK (saldo_bono_despues >= 0),
  referencia_tipo text NOT NULL, referencia_id text NOT NULL,
  clave_idempotencia text NOT NULL UNIQUE, descripcion text NOT NULL DEFAULT '',
  creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (monto_centimos = disponible_delta + bloqueado_delta + bono_delta)
);
CREATE FUNCTION impedir_mutacion_libro() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'El libro y la auditoría son inmutables; registra una compensación'; END;
$$;
CREATE TRIGGER movimientos_inmutables BEFORE UPDATE OR DELETE ON movimientos FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_libro();
CREATE TRIGGER movimientos_no_truncate BEFORE TRUNCATE ON movimientos FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_libro();

CREATE TABLE recargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES usuarios(id),
  monto_centimos bigint NOT NULL CHECK (monto_centimos > 0),
  pasarela text NOT NULL CHECK (pasarela IN ('niubiz','izipay','culqi','mercadopago')),
  metodo text NOT NULL, id_externo text UNIQUE, clave_idempotencia text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','fallida','revision')),
  payload_webhook jsonb, creada_en timestamptz NOT NULL DEFAULT now(), confirmada_en timestamptz
);
CREATE TABLE retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES usuarios(id),
  monto_centimos bigint NOT NULL CHECK (monto_centimos > 0), cuenta_destino jsonb NOT NULL,
  clave_idempotencia text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','aprobado','pagado','rechazado')),
  revisado_por text, solicitado_en timestamptz NOT NULL DEFAULT now(), revisado_en timestamptz, pagado_en timestamptz
);
CREATE TABLE comisiones_casa (
  partida_id uuid PRIMARY KEY REFERENCES partidas(id), pozo bigint NOT NULL CHECK (pozo >= 0),
  porcentaje_casa integer NOT NULL DEFAULT 16 CHECK (porcentaje_casa = 16),
  monto_casa bigint NOT NULL CHECK (monto_casa >= 0), monto_ranking bigint NOT NULL CHECK (monto_ranking >= 0)
);
CREATE TABLE conciliaciones (
  id bigserial PRIMARY KEY, fecha date NOT NULL, pasarela text NOT NULL,
  esperado_centimos bigint NOT NULL, recibido_centimos bigint NOT NULL,
  diferencia_centimos bigint NOT NULL, detalle jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now(), UNIQUE(fecha,pasarela),
  CHECK (diferencia_centimos = recibido_centimos - esperado_centimos)
);
CREATE TABLE auditoria_admin (
  id bigserial PRIMARY KEY, actor text NOT NULL, accion text NOT NULL,
  referencia_tipo text NOT NULL, referencia_id text NOT NULL, detalle jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER auditoria_inmutable BEFORE UPDATE OR DELETE ON auditoria_admin FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_libro();
CREATE TRIGGER auditoria_no_truncate BEFORE TRUNCATE ON auditoria_admin FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_libro();
CREATE TABLE alertas_uif (
  id bigserial PRIMARY KEY, usuario_id uuid REFERENCES usuarios(id), tipo text NOT NULL,
  detalle jsonb NOT NULL, estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','revisada','reportada')),
  creado_en timestamptz NOT NULL DEFAULT now(), revisado_por text
);

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo text NOT NULL CHECK (tipo IN ('mascota','skin_dado','avatar','efecto')),
  nombre text NOT NULL, rareza text, precio_centimos bigint CHECK (precio_centimos >= 0),
  precio_moneda_ingame integer CHECK (precio_moneda_ingame >= 0), archivo_modelo text, miniatura text,
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE inventario_usuario (
  usuario_id uuid NOT NULL REFERENCES usuarios(id), item_id uuid NOT NULL REFERENCES items(id),
  origen text NOT NULL CHECK (origen IN ('compra','premio','evento')),
  obtenido_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(usuario_id,item_id)
);
CREATE TABLE equipamiento (
  usuario_id uuid NOT NULL REFERENCES usuarios(id), slot text NOT NULL CHECK (slot IN ('mascota','skin_dado','avatar','efecto')),
  item_id uuid NOT NULL, PRIMARY KEY(usuario_id,slot), FOREIGN KEY(usuario_id,item_id) REFERENCES inventario_usuario(usuario_id,item_id)
);
CREATE TABLE compras_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES usuarios(id),
  item_id uuid NOT NULL REFERENCES items(id), movimiento_id bigint REFERENCES movimientos(id),
  precio_centimos bigint CHECK (precio_centimos >= 0), precio_moneda_ingame integer CHECK (precio_moneda_ingame >= 0),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limit (key text PRIMARY KEY, count integer NOT NULL DEFAULT 1 CHECK (count >= 0), reset_at bigint NOT NULL);
CREATE TABLE estado_live (id integer PRIMARY KEY DEFAULT 1 CHECK(id = 1), payload jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estado_live(id) VALUES(1);

CREATE INDEX movimientos_billetera_fecha ON movimientos(billetera_id,creado_en);
CREATE INDEX movimientos_referencia ON movimientos(referencia_tipo,referencia_id);
CREATE INDEX partidas_estado ON partidas(estado);
CREATE INDEX participantes_usuario ON participantes(usuario_id);
CREATE INDEX tiradas_partida_ronda ON tiradas(partida_id,ronda);
CREATE INDEX rate_limit_expira ON rate_limit(reset_at);

-- Do not grant anonymous/authenticated writes. Existing DNI cookies are authorized in Next.
-- Supabase Auth readers may access only the matching UUID; no policy reads private seeds.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','ratings','billeteras','equipos','equipo_miembros','limites_usuario','dados','caras_dado','partidas','participantes','tiradas','semillas_partida','movimientos','recargas','retiros','comisiones_casa','conciliaciones','auditoria_admin','alertas_uif','items','inventario_usuario','equipamiento','compras_items','rate_limit','estado_live'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO service_role',t); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    GRANT SELECT ON usuarios,ratings,billeteras,limites_usuario,movimientos,recargas,retiros,inventario_usuario,equipamiento,compras_items TO authenticated;
    CREATE POLICY usuario_propio ON usuarios FOR SELECT TO authenticated USING(id = (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid);
    FOREACH t IN ARRAY ARRAY['ratings','billeteras','limites_usuario','recargas','retiros','inventario_usuario','equipamiento','compras_items'] LOOP
      EXECUTE format('CREATE POLICY lectura_propia ON public.%I FOR SELECT TO authenticated USING(usuario_id = (NULLIF(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''sub'')::uuid)',t);
    END LOOP;
    CREATE POLICY movimientos_propios ON movimientos FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM billeteras b WHERE b.id=billetera_id AND b.usuario_id=(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid));
  END IF;
END $$;
REVOKE ALL ON FUNCTION impedir_mutacion_libro() FROM PUBLIC;
