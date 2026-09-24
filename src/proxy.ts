import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((path) => req.nextUrl.pathname.startsWith(path));
  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
