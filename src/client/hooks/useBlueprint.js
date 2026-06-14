import { useCallback } from 'react';

/** Read the existing lore.md blueprint from the project root. */
export function useBlueprint() {
  const readBlueprint = useCallback(async () => {
    const res = await fetch('/api/blueprint');
    if (!res.ok) throw new Error('Failed to read blueprint');
    return res.json();
  }, []);

  return { readBlueprint };
}
