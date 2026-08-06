/**
 * ApiDataService — dev adapter of the DataService contract (ADR-005).
 * fetch → /api (Vite proxy) → server/index.mjs → local PostgreSQL Desktop.
 * All responses are validated at the boundary (WS1-R2) and manifest schema
 * versions are checked/upgraded via the migration registry (WS1-R3).
 */
import type { BootstrapData, DataService, ProjectInterchange } from '@bs/schema';
import {
  DataServiceError,
  validateBootstrap,
  validateDraftAck,
  validateInterchange,
  validateReset,
} from './validate';
import { assertSupportedSchema, migrateManifest } from './migrations';

const PROJECT_SLUG = 'my-project';

async function json(res: Response): Promise<unknown> {
  if (res.status === 409) {
    const body = (await res.json()) as { draftVersion?: number };
    throw new DataServiceError('conflict', 'draft version conflict (FR-103)', {
      status: 409,
      draftVersion: body.draftVersion,
    });
  }
  if (!res.ok) throw new DataServiceError('http', `data service: HTTP ${res.status}`, { status: res.status });
  return (await res.json()) as unknown;
}

export class ApiDataService implements DataService {
  private draftVersion = 0;
  private saveQueue: Promise<unknown> = Promise.resolve();

  getDraftVersion(): number {
    return this.draftVersion;
  }

  setDraftVersion(version: number): void {
    this.draftVersion = version;
  }

  async init(): Promise<BootstrapData> {
    const raw = await json(await fetch('/api/bootstrap'));
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).offline) {
      return { offline: true } as unknown as BootstrapData;
    }
    const data = validateBootstrap(raw);
    // refuse newer-than-build manifests; upgrade older ones (WS1-R3)
    data.manifest = migrateManifest(data.manifest, data.project.schemaVersion).manifest;
    this.draftVersion = data.project.draftVersion;
    return data;
  }

  async saveDraft(manifest: unknown): Promise<{ draftVersion: number }> {
    const res = this.saveQueue.then(async () => {
      const out = validateDraftAck(
        await json(
          await fetch(`/api/projects/${PROJECT_SLUG}/draft`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ manifest, baseVersion: this.draftVersion }),
          }),
        ),
      );
      this.draftVersion = out.draftVersion;
      return out;
    });
    this.saveQueue = res.catch(() => {});
    return res;
  }

  async resetToSeed(): Promise<{ manifest: unknown; draftVersion: number }> {
    const out = validateReset(
      await json(await fetch(`/api/projects/${PROJECT_SLUG}/reset`, { method: 'POST' })),
    );
    this.draftVersion = out.draftVersion;
    return out;
  }

  async exportProject(): Promise<ProjectInterchange> {
    return validateInterchange(await json(await fetch(`/api/projects/${PROJECT_SLUG}/export`)));
  }

  async importProject(doc: ProjectInterchange): Promise<{ draftVersion: number }> {
    // refuse documents this build cannot represent BEFORE overwriting the draft
    validateInterchange(doc);
    assertSupportedSchema(doc.schemaVersion);
    const out = validateDraftAck(
      await json(
        await fetch(`/api/projects/${PROJECT_SLUG}/import`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(doc),
        }),
      ),
    );
    this.draftVersion = out.draftVersion;
    return out;
  }
}
