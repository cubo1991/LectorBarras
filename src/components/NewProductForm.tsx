"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
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
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">Código: {barcode}</p>
        <Field label="Nombre del producto" name="name" placeholder="Nombre del producto" required />
        <Field
          label="Stock inicial"
          name="stock"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Stock inicial"
          required
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit">Cargar producto</Button>
      </form>
    </Card>
  );
}
