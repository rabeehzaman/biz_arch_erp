"use client";

import { useState, useEffect } from "react";

interface Entity {
  id: string;
  name: string;
}

export function useComboboxEntities(url: string, enabled: boolean = true) {
  const [items, setItems] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [url, enabled]);

  return { items, isLoading };
}
