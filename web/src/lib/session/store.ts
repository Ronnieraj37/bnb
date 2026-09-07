// Hired-agent sessions, persisted client-side. A session is a REAL EIP-712
// signature from the user's wallet authorizing a scoped grant (which calls the
// agent may make, a spend cap, and an expiry). We store the signed grant so the
// marketplace can show what the user has hired, enforce the app-side scope, and
// let them revoke. Registering the same grant in the Altana Keystore for fully
// on-chain enforcement is the documented next step — the signature here is the
// same primitive that step would submit.

const KEY = "proven:hired";
export const CHANGED = "proven:hired-changed";

export type HiredSession = {
  id: string;              // `${agentId}` — one active session per agent
  agentId: string;
  agentName: string;
  category: string;
  owner: string;           // signer address
  allow: string[];         // allowlisted tool names
  capUsdt: number;
  createdAt: number;       // ms
  expiresAt: number;       // ms
  signature: string;       // the EIP-712 signature
};

function read(): HiredSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as HiredSession[]) : [];
    return all;
  } catch {
    return [];
  }
}

function write(list: HiredSession[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(CHANGED));
  } catch {
    // storage unavailable (private mode) — feature no-ops
  }
}

export const isActive = (s: HiredSession) => s.expiresAt > Date.now();

export const sessionStore = {
  get: read,
  active: () => read().filter(isActive),
  for: (agentId: string) => read().find((s) => s.agentId === agentId && isActive(s)),
  add: (s: HiredSession) => {
    const list = read().filter((x) => x.agentId !== s.agentId); // replace any prior
    list.push(s);
    write(list);
    return list;
  },
  remove: (agentId: string) => {
    write(read().filter((s) => s.agentId !== agentId));
  },
  clear: () => write([]),
};
