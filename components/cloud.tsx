"use client";
/**
 * Save online: login with Google, the shop's details once (name, mobile,
 * address), then the phone syncs by itself. Shown only when cloud save is
 * set up for this app; otherwise the app stays phone-only as before.
 */
import { useEffect, useState } from "react";
import { cloudOn } from "@/lib/cloud/client";
import { signInWithGoogle, signOut, currentUser, myShop, createShop, syncNow, type ShopDetails } from "@/lib/cloud/run";
import { loadCloudLocal } from "@/lib/cloud/local";
import { loadShop, saveShop } from "@/lib/shop";
import { cleanMobile } from "@/lib/cloud/mobile";

type View =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "details"; email: string }
  | { kind: "in"; email: string; shop: string };

export function CloudCard() {
  const [v, setV] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [d, setD] = useState<ShopDetails>(() => { const s = loadShop(); return { name: s.name ?? "", mobile: s.phone ?? "", address: s.address ?? "" }; });

  const refresh = async () => {
    const u = await currentUser();
    if (!u) return setV({ kind: "out" });
    const s = await myShop();
    setV(s ? { kind: "in", email: u.email, shop: s.name } : { kind: "details", email: u.email });
  };
  // the login lives outside React (browser storage): read it once after mounting
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (cloudOn()) void refresh().catch(() => setV({ kind: "out" })); }, []);
  if (!cloudOn()) return null;

  const last = loadCloudLocal().lastSync;
  const run = async (f: () => Promise<void>) => { setBusy(true); setMsg(""); try { await f(); } catch (e) { setMsg((e as Error).message || "Could not reach the internet. Try again."); } finally { setBusy(false); } };

  return (
    <div className="card mt-5 p-3">
      <div className="text-sm font-bold">Save online</div>
      {v.kind === "loading" && <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Checking…</p>}

      {v.kind === "out" && (
        <>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Your jobs and Window systems on any phone, and safe if this phone is lost. Free.</p>
          <button className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm" disabled={busy} onClick={() => run(signInWithGoogle)}>
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Continue with Google
          </button>
        </>
      )}

      {v.kind === "details" && (
        <>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Logged in as {v.email}. Your shop details, once:</p>
          <div className="mt-3 flex flex-col gap-2">
            <input className="dim-input w-full px-3 py-2.5 text-base" placeholder="Shop name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            <input className="dim-input w-full px-3 py-2.5 text-base" placeholder="Mobile number" inputMode="tel" autoComplete="tel" value={d.mobile} onChange={(e) => setD({ ...d, mobile: e.target.value })} />
            <input className="dim-input w-full px-3 py-2.5 text-base" placeholder="Address, city" autoComplete="street-address" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
          </div>
          {d.mobile && !cleanMobile(d.mobile) && <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>Type a 10-digit mobile number.</p>}
          <button className="btn-primary mt-3 w-full py-3" disabled={busy || !d.name.trim() || !cleanMobile(d.mobile)}
            onClick={() => run(async () => {
              const mobile = cleanMobile(d.mobile)!;
              await createShop({ name: d.name.trim(), mobile, address: d.address.trim() });
              saveShop({ ...loadShop(), name: d.name.trim(), phone: mobile, address: d.address.trim() });
              await syncNow();
              await refresh();
            })}>Save and start</button>
        </>
      )}

      {v.kind === "in" && (
        <>
          <p className="mt-1 text-xs" style={{ color: "var(--good)" }}>
            Saved online · {v.shop || v.email}{last ? ` · ${new Date(last).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn-ghost py-2.5 text-sm" disabled={busy} onClick={() => run(async () => { const r = await syncNow(); setMsg(r.applied ? "Updated from your other phone." : "Everything is saved."); if (r.applied) window.location.reload(); })}>Save now</button>
            <button className="btn-ghost py-2.5 text-sm" disabled={busy} onClick={() => run(async () => { await signOut(); await refresh(); })}>Log out</button>
          </div>
        </>
      )}
      {msg && <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}

/** Keeps the phone in step with the cloud: on open, every minute, and when the app goes to the background. */
export function CloudAutoSync() {
  useEffect(() => {
    if (!cloudOn()) return;
    let stop = false;
    const go = async (reloadOnChange: boolean) => {
      if (stop || !navigator.onLine) return;
      try {
        if (!(await currentUser()) || !(await myShop())) return;
        const r = await syncNow();
        // something came from another phone: show it (the screens read storage when they open)
        if (reloadOnChange && r.applied) window.location.reload();
      } catch { /* offline or not set up — try again later */ }
    };
    void go(true);
    const t = window.setInterval(() => void go(false), 60_000);
    const hide = () => { if (document.visibilityState === "hidden") void go(false); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("online", () => void go(false));
    return () => { stop = true; window.clearInterval(t); document.removeEventListener("visibilitychange", hide); };
  }, []);
  return null;
}
