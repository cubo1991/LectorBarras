import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// `prepare: false` es obligatorio contra el pooler de Supabase en modo
// transacción (puerto 6543), que es al que apunta DATABASE_URL: los prepared
// statements de postgres-js no sobreviven al pooling. Con el default
// (`prepare: true`) las transacciones concurrentes se PIERDEN EN SILENCIO —
// medido: 12 de 24 no commitearon, sin lanzar ningún error.
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(sql, { schema });
