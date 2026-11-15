/// <reference lib="webworker" />
/**
 * Reads a section's job off its drawing away from the screen, so the phone
 * stays responsive while it measures (a few seconds): its shape, the known
 * section it matches and where that goes in a window (know.ts).
 */
import { readSection } from "./know";

self.onmessage = (e: MessageEvent<{ id: number; shape: { w: number; h: number; paths: string[] } }>) => {
  const { id, shape } = e.data;
  try { (self as unknown as Worker).postMessage({ id, result: readSection(shape) }); }
  catch { (self as unknown as Worker).postMessage({ id, result: null }); }
};
