-- =====================================================================
-- Otra Ronda — esquema inicial
-- Multi-tenant por bar_id con Row Level Security.
-- Los clientes (anon) NUNCA escriben tablas directo: piden por RPC
-- (place_order, call_waiter), que calculan precios en el servidor.
-- =====================================================================

-- ---------- Tipos ----------
create type public.member_role as enum ('owner', 'staff');
create type public.order_mode as enum ('open', 'approve_first');
create type public.session_status as enum ('open', 'bill_requested', 'closed');
create type public.order_status as enum (
  'pending',    -- recién enviado, suena en el panel
  'accepted',   -- el bar lo vio / aprobó
  'preparing',
  'served',
  'rejected',
  'cancelled'
);
create type public.call_kind as enum ('waiter', 'bill');

-- ---------- Bares ----------
create table public.bars (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(name) between 1 and 80),
  logo_url      text,
  accent_color  text not null default '#E8572A' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  currency      text not null default 'ARS',
  order_mode    public.order_mode not null default 'open',
  ordering_enabled boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.bar_members (
  bar_id     uuid not null references public.bars(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (bar_id, user_id)
);
create index on public.bar_members (user_id);

-- ---------- Mesas ----------
create table public.tables (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references public.bars(id) on delete cascade,
  label      text not null check (length(label) between 1 and 20),  -- "5", "Barra 2", "Patio 3"
  -- Token del QR: no adivinable, regenerable si alguien filtra el QR.
  token      text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  active     boolean not null default true,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (bar_id, label)
);

-- ---------- Menú ----------
create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  bar_id   uuid not null references public.bars(id) on delete cascade,
  name     text not null check (length(name) between 1 and 60),
  position int not null default 0,
  active   boolean not null default true
);
create index on public.categories (bar_id, position);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references public.bars(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  description text check (length(description) <= 400),
  price       numeric(12,2) not null check (price >= 0),
  image_url   text,
  tags        text[] not null default '{}',   -- 'sin_tacc', 'vegano', 'picante', ...
  available   boolean not null default true,  -- "agotado" con un toque
  active      boolean not null default true,  -- oculto del menú
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.products (bar_id, category_id, position);

-- Modificadores: "Tamaño" (elegí 1), "Extras" (hasta 3), etc.
create table public.option_groups (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references public.bars(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  position   int not null default 0,
  check (min_select <= max_select)
);
create index on public.option_groups (product_id);

create table public.options (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references public.bars(id) on delete cascade,
  group_id    uuid not null references public.option_groups(id) on delete cascade,
  name        text not null,
  price_delta numeric(12,2) not null default 0,
  available   boolean not null default true,
  position    int not null default 0
);
create index on public.options (group_id);

-- ---------- Servicio ----------
-- Una "sesión" = la cuenta abierta de una mesa. Todos los que escanean
-- la misma mesa suman a la misma sesión hasta que el bar la cierra.
create table public.table_sessions (
  id        uuid primary key default gen_random_uuid(),
  bar_id    uuid not null references public.bars(id) on delete cascade,
  table_id  uuid not null references public.tables(id) on delete cascade,
  status    public.session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
-- Solo una sesión abierta por mesa.
create unique index one_open_session_per_table
  on public.table_sessions (table_id) where status <> 'closed';

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  bar_id        uuid not null references public.bars(id) on delete cascade,
  table_id      uuid not null references public.tables(id) on delete cascade,
  session_id    uuid not null references public.table_sessions(id) on delete cascade,
  customer_name text check (length(customer_name) <= 40),
  note          text check (length(note) <= 300),
  status        public.order_status not null default 'pending',
  total         numeric(12,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.orders (bar_id, created_at desc);
create index on public.orders (session_id);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references public.bars(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name       text not null,              -- copia: el pedido no cambia si editan el menú
  unit_price numeric(12,2) not null,     -- precio + extras, calculado en el servidor
  quantity   int not null check (quantity between 1 and 50),
  options    jsonb not null default '[]', -- [{group, name, price_delta}]
  note       text check (length(note) <= 200)
);
create index on public.order_items (order_id);

create table public.waiter_calls (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references public.bars(id) on delete cascade,
  table_id   uuid not null references public.tables(id) on delete cascade,
  session_id uuid references public.table_sessions(id) on delete set null,
  kind       public.call_kind not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.waiter_calls (bar_id, resolved, created_at desc);

-- ---------- Helpers de permisos ----------
create function public.is_bar_member(p_bar_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bar_members
    where bar_id = p_bar_id and user_id = (select auth.uid())
  );
$$;

create function public.is_bar_owner(p_bar_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bar_members
    where bar_id = p_bar_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- ---------- RLS ----------
alter table public.bars           enable row level security;
alter table public.bar_members    enable row level security;
alter table public.tables         enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.option_groups  enable row level security;
alter table public.options        enable row level security;
alter table public.table_sessions enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.waiter_calls   enable row level security;

-- El menú es público (lectura).
create policy "menu publico: bares" on public.bars
  for select to anon, authenticated using (true);
create policy "menu publico: categorias" on public.categories
  for select to anon, authenticated using (active or public.is_bar_member(bar_id));
create policy "menu publico: productos" on public.products
  for select to anon, authenticated using (active or public.is_bar_member(bar_id));
create policy "menu publico: grupos" on public.option_groups
  for select to anon, authenticated using (true);
create policy "menu publico: opciones" on public.options
  for select to anon, authenticated using (true);

-- Dueño: configuración del bar y equipo.
create policy "owner edita bar" on public.bars
  for update to authenticated using (public.is_bar_owner(id)) with check (public.is_bar_owner(id));
create policy "miembros ven equipo" on public.bar_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_bar_member(bar_id));
create policy "owner gestiona equipo" on public.bar_members
  for all to authenticated using (public.is_bar_owner(bar_id)) with check (public.is_bar_owner(bar_id));

-- Miembros: gestionan mesas, menú y servicio de SU bar.
create policy "miembros: mesas" on public.tables
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: categorias" on public.categories
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: productos" on public.products
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: grupos" on public.option_groups
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: opciones" on public.options
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: sesiones" on public.table_sessions
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: pedidos" on public.orders
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: items" on public.order_items
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));
create policy "miembros: llamados" on public.waiter_calls
  for all to authenticated using (public.is_bar_member(bar_id)) with check (public.is_bar_member(bar_id));

-- ---------- updated_at ----------
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RPC públicas (cliente en la mesa)
-- =====================================================================

-- Resuelve el QR -> bar + mesa. Devuelve null si el QR no es válido.
create function public.resolve_table(p_token text)
returns table (bar_id uuid, bar_slug text, table_id uuid, table_label text, ordering_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select b.id, b.slug, t.id, t.label, b.ordering_enabled
  from public.tables t join public.bars b on b.id = t.bar_id
  where t.token = p_token and t.active;
$$;

-- Abre (o reutiliza) la sesión de la mesa. Uso interno.
create function public._open_session(p_bar_id uuid, p_table_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.table_sessions
   where table_id = p_table_id and status <> 'closed';
  if v_id is null then
    insert into public.table_sessions (bar_id, table_id) values (p_bar_id, p_table_id)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then  -- carrera: otro cliente la abrió recién
      select id into v_id from public.table_sessions
       where table_id = p_table_id and status <> 'closed';
    end if;
  end if;
  return v_id;
end; $$;
revoke execute on function public._open_session(uuid, uuid) from public, anon, authenticated;

-- Enviar pedido.
-- p_items: [{ "product_id": uuid, "quantity": int, "option_ids": [uuid], "note": text }]
-- Los precios se calculan acá; lo que mande el cliente se ignora.
create function public.place_order(
  p_token text,
  p_items jsonb,
  p_customer_name text default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_table   record;
  v_session uuid;
  v_order   uuid;
  v_item    jsonb;
  v_prod    record;
  v_qty     int;
  v_opts    jsonb;
  v_delta   numeric(12,2);
  v_total   numeric(12,2) := 0;
begin
  select t.id, t.bar_id, b.ordering_enabled, b.order_mode into v_table
    from public.tables t join public.bars b on b.id = t.bar_id
   where t.token = p_token and t.active;
  if not found then raise exception 'QR_INVALIDO'; end if;
  if not v_table.ordering_enabled then raise exception 'PEDIDOS_DESACTIVADOS'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PEDIDO_VACIO';
  end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'PEDIDO_DEMASIADO_GRANDE'; end if;

  v_session := public._open_session(v_table.bar_id, v_table.id);

  insert into public.orders (bar_id, table_id, session_id, customer_name, note)
  values (v_table.bar_id, v_table.id, v_session,
          nullif(left(trim(p_customer_name), 40), ''), nullif(left(trim(p_note), 300), ''))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, name, price into v_prod from public.products
     where id = (v_item->>'product_id')::uuid
       and bar_id = v_table.bar_id and active and available;
    if not found then raise exception 'PRODUCTO_NO_DISPONIBLE:%', v_item->>'product_id'; end if;

    v_qty := coalesce((v_item->>'quantity')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'CANTIDAD_INVALIDA'; end if;

    -- Cada grupo de opciones debe respetar su mínimo y máximo (ej: "Tamaño" obligatorio).
    if exists (
      select 1 from public.option_groups g
       where g.product_id = v_prod.id
         and (select count(*) from public.options o
               where o.group_id = g.id and o.available
                 and o.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]')) x))
             not between g.min_select and g.max_select
    ) then
      raise exception 'OPCIONES_INVALIDAS:%', v_prod.name;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('group', g.name, 'name', o.name, 'price_delta', o.price_delta)
                              order by g.position, o.position), '[]'::jsonb),
           coalesce(sum(o.price_delta), 0)
      into v_opts, v_delta
      from public.options o join public.option_groups g on g.id = o.group_id
     where g.product_id = v_prod.id and o.available
       and o.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]')) x);

    insert into public.order_items (bar_id, order_id, product_id, name, unit_price, quantity, options, note)
    values (v_table.bar_id, v_order, v_prod.id, v_prod.name, v_prod.price + v_delta, v_qty, v_opts,
            nullif(left(trim(v_item->>'note'), 200), ''));

    v_total := v_total + (v_prod.price + v_delta) * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order;
  return v_order;
end; $$;

-- Llamar al mozo / pedir la cuenta.
create function public.call_waiter(p_token text, p_kind public.call_kind)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_table record; v_session uuid; v_id uuid;
begin
  select id, bar_id into v_table from public.tables where token = p_token and active;
  if not found then raise exception 'QR_INVALIDO'; end if;

  select id into v_session from public.table_sessions
   where table_id = v_table.id and status <> 'closed';
  if p_kind = 'bill' and v_session is not null then
    update public.table_sessions set status = 'bill_requested' where id = v_session;
  end if;

  -- Evita spam: si ya hay un llamado igual sin atender, devuelve ese.
  select id into v_id from public.waiter_calls
   where table_id = v_table.id and kind = p_kind and not resolved;
  if v_id is null then
    insert into public.waiter_calls (bar_id, table_id, session_id, kind)
    values (v_table.bar_id, v_table.id, v_session, p_kind) returning id into v_id;
  end if;
  return v_id;
end; $$;

-- Lo que ve el cliente de su mesa: pedidos de la sesión abierta y su estado.
create function public.table_status(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'session_status', s.status,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'customer_name', o.customer_name, 'status', o.status,
        'total', o.total, 'created_at', o.created_at,
        'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity,
                                                       'unit_price', i.unit_price, 'options', i.options))
                    from public.order_items i where i.order_id = o.id)
      ) order by o.created_at)
      from public.orders o where o.session_id = s.id and o.status not in ('rejected', 'cancelled')
    ), '[]'::jsonb)
  )
  from public.tables t
  left join public.table_sessions s on s.table_id = t.id and s.status <> 'closed'
  where t.token = p_token and t.active;
$$;

grant execute on function public.resolve_table(text) to anon, authenticated;
grant execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.call_waiter(text, public.call_kind) to anon, authenticated;
grant execute on function public.table_status(text) to anon, authenticated;

-- =====================================================================
-- RPC del panel
-- =====================================================================

-- Crear un bar: quien lo crea queda como owner.
create function public.create_bar(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'NO_AUTENTICADO'; end if;
  insert into public.bars (name, slug) values (trim(p_name), lower(trim(p_slug))) returning id into v_id;
  insert into public.bar_members (bar_id, user_id, role) values (v_id, (select auth.uid()), 'owner');
  return v_id;
end; $$;

-- Crear N mesas numeradas (1..N), sin duplicar las que ya existen.
create function public.create_tables(p_bar_id uuid, p_count int)
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not public.is_bar_member(p_bar_id) then raise exception 'SIN_PERMISO'; end if;
  if p_count < 1 or p_count > 200 then raise exception 'CANTIDAD_INVALIDA'; end if;
  insert into public.tables (bar_id, label, position)
  select p_bar_id, n::text, n from generate_series(1, p_count) n
  on conflict (bar_id, label) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

-- Cerrar la mesa (cobrada).
create function public.close_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_bar uuid;
begin
  select bar_id into v_bar from public.table_sessions where id = p_session_id;
  if v_bar is null or not public.is_bar_member(v_bar) then raise exception 'SIN_PERMISO'; end if;
  update public.table_sessions set status = 'closed', closed_at = now() where id = p_session_id;
  update public.waiter_calls set resolved = true where session_id = p_session_id and not resolved;
end; $$;

-- Regenerar el QR de una mesa (invalida el impreso).
create function public.rotate_table_token(p_table_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_bar uuid; v_token text;
begin
  select bar_id into v_bar from public.tables where id = p_table_id;
  if v_bar is null or not public.is_bar_member(v_bar) then raise exception 'SIN_PERMISO'; end if;
  update public.tables set token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
   where id = p_table_id returning token into v_token;
  return v_token;
end; $$;

revoke execute on function public.create_bar(text, text) from public, anon;
revoke execute on function public.create_tables(uuid, int) from public, anon;
revoke execute on function public.close_session(uuid) from public, anon;
revoke execute on function public.rotate_table_token(uuid) from public, anon;
grant execute on function public.create_bar(text, text) to authenticated;
grant execute on function public.create_tables(uuid, int) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
grant execute on function public.rotate_table_token(uuid) to authenticated;

-- ---------- Tiempo real para el panel ----------
alter publication supabase_realtime add table public.orders, public.order_items,
  public.waiter_calls, public.table_sessions, public.products;
