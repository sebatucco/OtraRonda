# Otra Ronda — guía para trabajar en el repo

Menú QR por mesa para bares (LatAm, en español). Ver README.md para el producto y la estructura.

## Convenciones

- SvelteKit **3** + Svelte 5 (runes). Ojo con las APIs nuevas:
  - Variables de entorno: se declaran en `src/env.ts` con `defineEnvVars` y se importan de `$app/env/public` / `$app/env/private` (no `$env/...`, está deprecado).
  - Tipos de hooks: `import type { Handle } from '@sveltejs/kit/hooks'`.
  - Alias de lib: `#lib/archivo.js` (subpath imports; con extensión `.js` aunque el archivo sea `.ts`).
- Textos de la interfaz en español rioplatense neutro ("pedí", "escaneá"), precios con `price()` de `#lib/format.js`.
- Diseño mobile-first: texto base 17px, objetivos táctiles grandes, `--accent` = color de cada bar.
- El cliente (anon) nunca escribe tablas: todo pasa por RPC `security definer` en `supabase/migrations`.
  Cualquier tabla nueva necesita RLS por `bar_id` usando `is_bar_member()` / `is_bar_owner()`.
- Cambios de esquema = migración nueva en `supabase/migrations/` (no editar migraciones ya aplicadas en producción).

## Antes de commitear

`npm run check && npm run lint && npm run build`
