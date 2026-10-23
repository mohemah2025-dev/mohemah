import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export type Address = { id: string; label: string; address: string; region: string | null; lat: number | null; lng: number | null; is_default: number };

const listeners = new Set<() => void>();
/** Tells every mounted address list to reload (after add / delete / default change). */
export const notifyAddressesChanged = () => listeners.forEach((l) => l());

export function useAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const load = useCallback(async () => {
    if (!user) { setAddresses([]); return; }
    try { setAddresses(await api<Address[]>("/api/me/addresses")); } catch { /* ignore */ }
  }, [user?.id]);
  useEffect(() => { load(); listeners.add(load); return () => { listeners.delete(load); }; }, [load]);
  return { addresses, defaultAddress: addresses.find((a) => a.is_default) ?? addresses[0] ?? null, reload: load };
}

/** Favorite sub-services: synced to the account when signed in, kept on the device for guests. */
const FAV_KEY = "mohemah_favorites_v2";
const favListeners = new Set<(ids: string[]) => void>();
let favCache: string[] | null = null;

function readLocal(): string[] {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
function writeLocal(ids: string[]) { try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); } catch { /* ignore */ } }

export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>(favCache ?? []);
  useEffect(() => {
    const l = (v: string[]) => setIds(v);
    favListeners.add(l);
    (async () => {
      let v = readLocal();
      if (user) {
        try {
          const server = await api<string[]>("/api/me/favorites");
          // First sign-in on this device: merge guest favorites into the account.
          const merged = [...new Set([...server, ...v])];
          v = merged.length !== server.length ? await api<string[]>("/api/me/favorites", { method: "PUT", body: { ids: merged } }) : server;
          writeLocal([]);
        } catch { /* offline */ }
      }
      favCache = v;
      favListeners.forEach((f) => f(v));
    })();
    return () => { favListeners.delete(l); };
  }, [user?.id]);

  const toggle = useCallback(async (subId: string) => {
    const cur = favCache ?? [];
    const next = cur.includes(subId) ? cur.filter((x) => x !== subId) : [...cur, subId];
    favCache = next;
    favListeners.forEach((f) => f(next));
    if (user) { try { await api("/api/me/favorites", { method: "PUT", body: { ids: next } }); } catch { /* ignore */ } }
    else writeLocal(next);
  }, [user?.id]);

  return { favoriteIds: ids, toggleFavorite: toggle, isFavorite: (id: string) => ids.includes(id) };
}
