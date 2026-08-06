/**
 * Manifest schema-version registry (WS1-R3, dev plan WS1.4 residual).
 *
 * The manifest carries `schemaVersion` (projects.schema_version in PostgreSQL,
 * `schemaVersion` in the interchange document). This module is the single
 * place that knows which versions this build can load and how to upgrade
 * older ones. Rules:
 *  - forward-only, stepwise (v(n) → v(n+1)), mirroring db/migrations discipline;
 *  - a manifest NEWER than this build is refused explicitly
 *    (`unsupported_schema`) — never silently loaded (data-loss guard);
 *  - migrations are pure functions: input is never mutated.
 */
import { CURRENT_SCHEMA_VERSION } from '@bs/schema';
import { DataServiceError } from './validate';

;

interface ManifestMigration {
  /** upgrades a manifest FROM this version to `from + 1` */
  from: number;
  note: string;
  migrate(manifest: unknown): unknown;
}

/** v1 is the baseline — the registry starts empty; register v1→v2 here when
 *  the manifest schema first changes (same MR as the change, IL-13). */
const REGISTRY: ManifestMigration[] = [];

/** Throws `unsupported_schema` when this build cannot load the version. */
export function assertSupportedSchema(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new DataServiceError('invalid_payload', `schemaVersion ${version} is not a valid version`, {
      issues: ['schemaVersion'],
    });
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new DataServiceError(
      'unsupported_schema',
      `manifest schemaVersion ${version} is newer than this build (supports ≤ ${CURRENT_SCHEMA_VERSION}) — update the editor instead of loading (data-loss guard)`,
    );
  }
}

/** Upgrade a manifest to CURRENT_SCHEMA_VERSION (no-op at current). */
export function migrateManifest(
  manifest: unknown,
  fromVersion: number,
): { manifest: unknown; schemaVersion: number } {
  assertSupportedSchema(fromVersion);
  let doc = manifest;
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = REGISTRY.find((m) => m.from === v);
    if (!step) {
      throw new DataServiceError(
        'unsupported_schema',
        `no migration registered for schemaVersion ${v} → ${v + 1} (registry gap)`,
      );
    }
    doc = step.migrate(structuredClone(doc));
  }
  return { manifest: doc, schemaVersion: CURRENT_SCHEMA_VERSION };
}
