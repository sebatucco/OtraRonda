-- Datos de demo para desarrollo local: un bar con menú y 6 mesas.
-- El QR de la mesa 1 es /m/la-esquina/demo-mesa-1
insert into public.bars (id, slug, name, accent_color)
values ('00000000-0000-0000-0000-0000000000b1', 'la-esquina', 'La Esquina', '#E8572A');

insert into public.tables (bar_id, label, position, token)
select '00000000-0000-0000-0000-0000000000b1', n::text, n, 'demo-mesa-' || n
from generate_series(1, 6) n;

insert into public.categories (id, bar_id, name, position) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Cervezas', 1),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'Tragos', 2),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b1', 'Para picar', 3);

insert into public.products (id, bar_id, category_id, name, description, price, tags, position) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
   'IPA tirada', 'Lupulada, amarga y cítrica. 6,5% ABV.', 4500, '{}', 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
   'Honey tirada', 'Suave, con miel de la zona.', 4200, '{}', 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2',
   'Fernet con coca', 'El clásico.', 5000, '{}', 1),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2',
   'Gin tonic', 'Gin, tónica, pepino y pimienta rosa.', 6500, '{}', 2),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3',
   'Papas con cheddar', 'Con panceta y verdeo.', 7800, '{}', 1),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c3',
   'Empanadas tucumanas (x3)', 'De carne cortada a cuchillo.', 6000, '{sin_tacc}', 2);

-- Tamaño de las cervezas
insert into public.option_groups (id, bar_id, product_id, name, min_select, max_select) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Tamaño', 1, 1);
insert into public.options (bar_id, group_id, name, price_delta, position) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'Pinta', 0, 1),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'Jarra 1 L', 3500, 2);
