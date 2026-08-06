/**
 * Viewport handle registry (Doc 04   5 bridge rule).
 * Keeps the singleton ViewportHandle reference so shell panels can control
 * camera navigation / tool mode without passing props through React trees.
 * React-free   " imperative reference only (IL-3).
 */
import type { ViewportHandle } from './runtime';

let currentHandle: ViewportHandle | null = null;

export function registerViewport(handle: ViewportHandle | null): void {
  currentHandle = handle;
}

export function getViewport(): ViewportHandle | null {
  return currentHandle;
}
