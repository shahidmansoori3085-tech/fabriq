/**
 * Counts the steps that matter — a material list made, an order sent — as
 * page views on made-up paths ("/done/material-list"), so they show up in
 * Vercel Web Analytics on the free plan (custom events need Pro). Nothing
 * about the job or the shop is sent: only the step's name.
 */
import { pageview } from "@vercel/analytics";

export type Step =
  | "material-list"
  | "cutting-sheet"
  | "sent/aluminium-order"
  | "sent/glass-order"
  | "sent/cutting-sheet";

export function markStep(step: Step): void {
  try {
    pageview({ route: `/done/${step}`, path: `/done/${step}` });
  } catch {
    /* analytics blocked or not loaded — the app works the same */
  }
}
