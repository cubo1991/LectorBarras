"use client";

import { useState } from "react";
import { createProduct, type Product } from "@/lib/actions/products";

type Props = {
  barcode: string;
  onCreated: (product: Product) => void;
};

export function NewProductForm({ barcode, onCreated }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await createProduct({
      barcode,
      name: formData.get("name"),
      stock: formData.get("stock"),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.product);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border p-4">
      <p className="text-sm text-gray-600">Código: {barcode}</p>
      <input name="name" placeholder="Nombre del producto" required className="border p-2" />
      <input
        name="stock"
        type="number"
        min={0}
        placeholder="Stock inicial"
        required
        className="border p-2"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="min-h-11 bg-black p-2 text-white">
        Dar de alta
      </button>
    </form>
  );
}
