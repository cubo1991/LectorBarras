# Spec: LectorBarras

## Objective

App web de gestión de inventario por código de barras. El usuario escanea un producto con la cámara del dispositivo (celular o notebook), la app identifica el código y permite ver/actualizar el stock. Si el código no existe en el catálogo, permite darlo de alta.

**Usuarios**: equipo interno (varias personas, con login) gestionando un único inventario compartido — no es multi-tenant.

**Éxito**: un usuario puede loguearse, escanear un producto con la cámara, ver su stock actual, sumar/restar unidades, y buscar productos por nombre o código — todo desde el navegador, sin instalar nada.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Base de datos: Postgres (Supabase, vía integración de Vercel) — driver `postgres.js`
- ORM: Drizzle
- Auth: Auth.js (NextAuth v5), credenciales email + contraseña
- Escaneo de código de barras: `@zxing/browser`
- Estilos: Tailwind CSS
- Validación: Zod
- Testing: Vitest (unit) + Playwright (e2e)

## Commands

```
Dev:        npm run dev
Build:      npm run build
Start:      npm start
Lint:       npm run lint
Test:       npm test
E2E:        npm run test:e2e
DB migrate: npm run db:generate && npm run db:migrate
DB studio:  npm run db:studio
```

## Project Structure

```
src/app/                 → Rutas (App Router): páginas y layouts
src/app/api/             → Route handlers (solo si un server action no alcanza)
src/components/          → Componentes React (UI compartida)
src/lib/db/schema.ts     → Esquema Drizzle
src/lib/db/client.ts     → Cliente de conexión a la DB
src/lib/actions/         → Server actions (mutaciones: alta producto, ajuste de stock)
src/lib/auth.ts          → Config de Auth.js
src/lib/scanner.ts       → Wrapper sobre @zxing/browser
drizzle/                 → Migraciones generadas por drizzle-kit
tests/                   → Tests unitarios (Vitest)
e2e/                     → Tests end-to-end (Playwright)
```

## Code Style

- TypeScript estricto (`strict: true`), sin `any` salvo justificado con comentario.
- Server Components por default; `"use client"` solo donde hace falta interactividad (ej. el componente de escaneo).
- Mutaciones vía Server Actions, no API routes, salvo que un tercero externo necesite pegarle a un endpoint.
- Validación de todo input de usuario con Zod antes de tocar la DB.

```ts
// src/lib/actions/stock.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { products, stockMovements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0),
});

export async function adjustStock(input: z.infer<typeof adjustStockSchema>) {
  const { productId, delta } = adjustStockSchema.parse(input);
  // ...
}
```

## Testing Strategy

- **Unit (Vitest)**: lógica de negocio pura — cálculo de stock, parseo/validación de códigos de barras, schemas Zod. Viven junto al archivo que testean (`*.test.ts`) o en `tests/`.
- **E2E (Playwright)**: flujos críticos — login, escanear (mock de cámara) → encontrar producto → ajustar stock, alta de producto nuevo, búsqueda.
- No se persigue cobertura exhaustiva de UI; foco en lógica de negocio y flujos que rompen el inventario si fallan.

## Boundaries

- **Always**: correr `npm run lint` y `npm test` antes de commitear; validar todo input server-side con Zod; todo cambio de stock queda registrado en `stock_movements` (quién, cuándo, cuánto).
- **Ask first**: cambios de esquema de DB / migraciones, agregar dependencias nuevas, cambiar el proveedor de auth, tocar config de deploy.
- **Never**: commitear `.env` o secretos, guardar contraseñas en texto plano, borrar tests que fallan sin aprobación.

## Success Criteria

- [ ] Un usuario puede registrarse/loguearse con email y contraseña.
- [ ] Un usuario logueado puede activar la cámara y escanear un código de barras (EAN-13, UPC-A como mínimo).
- [ ] Si el código existe, muestra el producto y su stock actual.
- [ ] Si el código no existe, ofrece darlo de alta (nombre, código, stock inicial).
- [ ] Un usuario puede sumar o restar stock de un producto, y queda registrado el movimiento (usuario + timestamp + delta).
- [ ] Un usuario puede buscar productos por nombre o código sin escanear.
- [ ] La app funciona en un navegador de escritorio y uno mobile (Chrome/Safari), pidiendo permiso de cámara correctamente.
- [ ] Catálogo soporta al menos 5000 productos sin degradación notable en búsqueda/listado.

## Open Questions

- ¿Hace falta imprimir/generar códigos de barras para productos que no traen uno de fábrica? (no contemplado en este spec)
- ¿Hace falta historial/reportes de movimientos de stock (ej. exportar a Excel)? (no contemplado)
- ¿Roles (admin vs operador)? Por ahora todos los usuarios logueados tienen los mismos permisos.
- ¿Soporte offline (sin conexión) para escanear y sincronizar después? Asumido que no, por ahora.
