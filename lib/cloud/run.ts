/**
 * Cloud save on the phone: login with Google, the shop's details once, and
 * syncing (pull → merge → push). The merge rules are in ./sync.ts.
 */
import { cloud } from "./client";
import { reconcile, type Row } from "./sync";
import { snapshot, applyRows, loadCloudLocal, saveCloudLocal, clearCloudLocal } from "./local";

export interface ShopDetails { name: string; mobile: string; address: string }

export async function signInWithGoogle(): Promise<void> {
  const c = cloud(); if (!c) return;
  await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
}

export async function signOut(): Promise<void> {
  const c = cloud(); if (!c) return;
  await c.auth.signOut();
  // the phone keeps its data; it just stops syncing
  clearCloudLocal();
}

export async function currentUser(): Promise<{ id: string; email: string; name: string } | null> {
  const c = cloud(); if (!c) return null;
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? "", name: (u.user_metadata?.full_name as string) ?? "" } : null;
}

/** The shop this login belongs to, or null when the shop details are still to be given. */
export async function myShop(): Promise<{ id: string } & ShopDetails | null> {
  const c = cloud(); if (!c) return null;
  const { data } = await c.from("shops").select("id,name,mobile,address").limit(1).maybeSingle();
  return data ? (data as { id: string } & ShopDetails) : null;
}

/** First login: make the shop (once) and link this phone to it. */
export async function createShop(d: ShopDetails): Promise<string> {
  const c = cloud(); if (!c) throw new Error("Cloud is off");
  const { data, error } = await c.rpc("create_shop", { p_name: d.name, p_mobile: d.mobile, p_address: d.address, p_city: "" });
  if (error) throw error;
  const local = loadCloudLocal();
  saveCloudLocal({ ...local, shopId: data as string });
  return data as string;
}

const PAGE = 500;

/** One sync. Returns how many records came in and went out. */
export async function syncNow(): Promise<{ pulled: number; pushed: number; applied: number }> {
  const c = cloud(); if (!c) return { pulled: 0, pushed: 0, applied: 0 };
  const local = loadCloudLocal();
  let shopId = local.shopId;
  if (!shopId) { const s = await myShop(); if (!s) throw new Error("Shop details not given yet"); shopId = s.id; }

  // pull what changed in the cloud since the last pull (by server write time)
  const pulled: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = c.from("records").select("kind,id,data,updated_at,deleted_at,synced_at").eq("shop_id", shopId).order("synced_at").range(from, from + PAGE - 1);
    if (local.state.lastPull) q = q.gt("synced_at", local.state.lastPull);
    const { data, error } = await q;
    if (error) throw error;
    pulled.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const r = reconcile(snapshot(), local.state, pulled, Date.now());
  const applied = applyRows(r.apply);

  for (let i = 0; i < r.push.length; i += PAGE) {
    const { error } = await c.rpc("push_records", { p_shop: shopId, p_rows: r.push.slice(i, i + PAGE) });
    if (error) throw error;
  }
  saveCloudLocal({ shopId, state: r.state, lastSync: Date.now() });
  return { pulled: pulled.length, pushed: r.push.length, applied };
}
