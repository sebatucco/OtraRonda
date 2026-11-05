-- Productos destacados (carrusel al principio de la carta) y foto de portada del bar.
alter table public.products add column featured boolean not null default false;
alter table public.bars add column cover_url text;

create index products_featured on public.products (bar_id) where featured and active;
