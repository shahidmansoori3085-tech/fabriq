/**
 * The fabricator's own shop details — printed on the supplier order and the
 * workshop sheet. Stored on the device only; there is no account.
 */
export interface ShopProfile {
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  tagline?: string;
}

const KEY = "fabriq_shop";

export function loadShop(): ShopProfile {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    return s && typeof s.name === "string" ? s : { name: "" };
  } catch {
    return { name: "" };
  }
}

export function saveShop(s: ShopProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked — keep in memory */ }
}
