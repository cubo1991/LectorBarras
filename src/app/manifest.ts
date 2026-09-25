import type { MetadataRoute } from "next";

// Instalable = manifest + íconos + standalone. Sin service worker: la app no
// tiene requisito offline. El manifest y los íconos deben ser públicos (ver el
// matcher de src/proxy.ts): el navegador los pide sin cookies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LectorBarras",
    short_name: "LectorBarras",
    description: "Inventario por código de barras: escaneá un producto y ajustá su stock.",
    start_url: "/scan", // la app instalada abre directo en el escáner
    display: "standalone",
    lang: "es",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
