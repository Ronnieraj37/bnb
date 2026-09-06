// Tiny client-side compare selection, backed by localStorage so it survives
// navigation between the browse and compare pages. Capped at 3 — anything
// wider stops being scannable in a side-by-side table.

const KEY = "proven:compare";
const MAX = 3;

export type CompareEntry = { id: string; name: string; category: string };

function read(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CompareEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: CompareEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("proven:compare-changed"));
  } catch {
    // Storage can be unavailable (private mode); the feature just no-ops.
  }
}

export const compareStore = {
  MAX,
  get: read,
  has: (id: string) => read().some((e) => e.id === id),
  toggle: (entry: CompareEntry): CompareEntry[] => {
    const list = read();
    const i = list.findIndex((e) => e.id === entry.id);
    if (i >= 0) list.splice(i, 1);
    else if (list.length < MAX) list.push(entry);
    write(list);
    return list;
  },
  clear: () => write([]),
};
