/**
 * Tamaño de página del listado de productos.
 * Vive fuera de `actions/products.ts` porque un módulo "use server" sólo puede
 * exportar funciones async.
 */
export const PRODUCTS_PAGE_SIZE = 20;
