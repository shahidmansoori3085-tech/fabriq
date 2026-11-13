/// <reference lib="webworker" />
/**
 * Reads a section's job off its drawing away from the screen, so the phone
 * stays responsive while it measures (a few seconds).
 */
import { recognize } from "./recognize";

self.onmessage = (e: MessageEvent<{ id: number; shape: { w: number; h: number; paths: string[] } }>) => {
  const { id, shape } = e.data;
  try { (self as unknown as Worker).postMessage({ id, result: recognize(shape) }); }
  catch { (self as unknown as Worker).postMessage({ id, result: null }); }
};
