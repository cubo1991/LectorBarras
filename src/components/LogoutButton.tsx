import { logoutAction } from "@/lib/actions/auth";

/**
 * Cierre de sesión. Es un `<form>` con server action y no un `onClick`, para que
 * funcione aunque la página no haya hidratado.
 */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="min-h-11 rounded-control px-3 text-sm text-muted underline">
        Cerrar sesión
      </button>
    </form>
  );
}
