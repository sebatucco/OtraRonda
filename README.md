# Otra Ronda 🍺

Menú QR por mesa para bares. El cliente escanea, pide desde el celular sin descargar nada,
y el bar ve **qué mesa pidió qué** en tiempo real.

## Stack

| Pieza                                      | Tecnología                                  |
| ------------------------------------------ | ------------------------------------------- |
| Web (cliente y panel)                      | SvelteKit 3 + Svelte 5 + TypeScript         |
| Estilos                                    | Tailwind CSS 4                              |
| Base de datos, auth, tiempo real, archivos | Supabase (Postgres + RLS, región São Paulo) |
| Hosting                                    | Cloudflare Workers                          |

## Estructura

```
src/
  env.ts                    variables de entorno (API nueva de SvelteKit 3)
  hooks.server.ts           cliente de Supabase por request (cookies)
  lib/
    supabase.ts             cliente para el navegador
    types.ts, format.ts     tipos y formato de precios ($ 4.500)
  routes/
    +page.svelte            landing
    m/[bar]/[mesa]/         menú del cliente  →  URL del QR
    panel/                  panel del bar (en construcción)
supabase/
  migrations/               esquema SQL con RLS y funciones (RPC)
  seed.sql                  bar de demo "La Esquina" con 6 mesas
```

## Cómo funciona la seguridad

- Cada mesa tiene un **token aleatorio** en su QR: `/m/la-esquina/a1b2c3d4e5f6`.
  Se puede regenerar si alguien lo filtra (`rotate_table_token`).
- Los clientes **no escriben tablas directamente**. Piden con la función `place_order`,
  que valida el QR, los productos disponibles y las opciones, y **calcula los precios en el servidor**.
- Todos los datos del bar están separados por `bar_id` con Row Level Security:
  un bar nunca ve los pedidos de otro.
- Varias personas en la misma mesa suman a la misma cuenta (`table_sessions`), cada pedido con su nombre.

### Funciones disponibles

| Función                                   | Quién   | Qué hace                         |
| ----------------------------------------- | ------- | -------------------------------- |
| `resolve_table(token)`                    | cliente | QR → bar + mesa                  |
| `place_order(token, items, nombre, nota)` | cliente | envía un pedido                  |
| `call_waiter(token, 'waiter' \| 'bill')`  | cliente | llamar al mozo / pedir la cuenta |
| `table_status(token)`                     | cliente | pedidos y estado de su mesa      |
| `create_bar(nombre, slug)`                | bar     | crea el bar y lo deja como dueño |
| `create_tables(bar_id, n)`                | bar     | crea las mesas 1..n              |
| `close_session(session_id)`               | bar     | cierra la mesa (cobrada)         |
| `rotate_table_token(table_id)`            | bar     | regenera el QR de una mesa       |

## Empezar a desarrollar

1. Instalá dependencias: `npm install`
2. Creá un proyecto en [Supabase](https://supabase.com) (región **South America — São Paulo**).
3. En Supabase → **SQL Editor**, ejecutá en orden:
   - `supabase/migrations/20261105000000_init.sql`
   - `supabase/seed.sql` (opcional, datos de demo)
4. Copiá `.env.example` a `.env` y completá la URL y la clave pública (Project Settings → API).
5. `npm run dev` y abrí <http://localhost:5173/m/la-esquina/demo-mesa-1>

> `npm run build` valida las variables de entorno: sin `.env` (o sin las variables
> configuradas en Cloudflare) el build falla a propósito, con un mensaje claro.

## Comandos

```bash
npm run dev       # servidor local
npm run check     # chequeo de tipos
npm run lint      # prettier + eslint
npm run build     # build para Cloudflare
npm run preview   # probar el build con wrangler
```

## Hoja de ruta (v1)

- [x] Base del proyecto, esquema y seguridad
- [x] Menú del cliente (lectura)
- [ ] Hoja de producto con opciones, carrito y envío del pedido
- [ ] Estado del pedido + llamar al mozo / pedir la cuenta
- [ ] Panel: login, salón por colores, pedidos en vivo con sonido
- [ ] Menú: agotado con un toque, editor, fotos (WebP al subir)
- [ ] PDF con los QR de todas las mesas
- [ ] Importar la carta con IA desde una foto
- [ ] Deploy en Cloudflare
