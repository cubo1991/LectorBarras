import { redirect } from "next/navigation";

// Escanear es la tarea dominante: tras el login se entra directo al escáner. `/` se
// mantiene (links viejos, la barra de direcciones) y lleva ahí.
export default function Home() {
  redirect("/scan");
}
