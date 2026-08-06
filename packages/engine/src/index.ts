/**
 * @bs/engine — canonical command engine, evaluator, store & state bus.
 *
 * Doc 04 §1 · IL-1 · Plan 06 §3.4.
 * Physical move complete (WS2-1c): every export below lives inside this package.
 * No reverse `packages/engine → src/` imports remain (see `bus.ts`
 * `registerPersistenceHook` and `asset.ts` `registerAssetBlobHooks` — the two
 * hook APIs that let shell-level persistence subscribe without inverting the
 * dependency).
 */

// Evaluator (pure, deterministic — Doc 04 §4)
export {
  channelSpans,
  createEvaluator,
  sampleKeyframes,
  trackSignature,
  type EvaluatedState,
} from './evaluator';

// Full command engine surface (per-domain commands + bus)
export * from './commands/index';

// Persistence + asset-blob hook APIs (Plan 06 §3.4)
export { registerPersistenceHook } from './commands/bus';
export { registerAssetBlobHooks, type AssetBlobHooks } from './commands/asset';

// Store surface (editor UI state, selection, theme, panels)
export * from './store';
