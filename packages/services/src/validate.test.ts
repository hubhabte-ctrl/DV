/**
 * WS1-R2/R3/R5 regression tests:
 *  - boundary validation rejects malformed payloads with typed errors
 *  - transport errors are typed (http/conflict)
 *  - schema-version guard refuses newer-than-build manifests (data-loss guard)
 *  - conflict handler fires once per distinct server version (no toast spam)
 */
// @ts-ignore
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateBootstrap, validateInterchange, DataServiceError } from './validate';
import { assertSupportedSchema, migrateManifest } from './migrations';
import { CURRENT_SCHEMA_VERSION } from '@bs/schema';
import { ApiDataService } from './api';
import { initData, registerConflictHandler, syncDraft } from './index';

const goodBootstrap = {
  source: 'postgresql',
  project: { slug: 'fleet-story', name: 'Fleet Story', schemaVersion: 1, draftVersion: 1 },
  manifest: { domNodes: {} },
  componentDefs: { toolbox: [{ id: 'cmp-x', label: 'X', description: '' }] },
  componentTemplates: {},
  inspectorSchema: { dom: [], scene: [] },
};

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const spy = vi.fn((url: string, init?: RequestInit) => {
    const { status, body } = handler(String(url), init);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('boundary validation (WS1-R2)', () => {
  it('accepts a well-formed bootstrap', () => {
    expect(validateBootstrap(structuredClone(goodBootstrap)).project.slug).toBe('fleet-story');
  });

  it('rejects malformed bootstrap with typed error and issue paths', () => {
    const bad = { ...structuredClone(goodBootstrap), project: { slug: '', draftVersion: 'x' } };
    try {
      validateBootstrap(bad);
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as DataServiceError;
      expect(e).toBeInstanceOf(DataServiceError);
      expect(e.code).toBe('invalid_payload');
      expect(e.issues?.join(' ')).toContain('project.slug');
      expect(e.issues?.join(' ')).toContain('project.draftVersion');
    }
  });

  it('rejects a non-interchange document', () => {
    expect(() => validateInterchange({ format: 'zip', manifest: {} })).toThrowError(DataServiceError);
  });

  it('surfaces non-OK transport as a typed http error', async () => {
    stubFetch(() => ({ status: 500, body: { error: 'boom' } }));
    await expect(new ApiDataService().init()).rejects.toMatchObject({ code: 'http', status: 500 });
  });

  it('rejects a malformed server bootstrap (missing manifest)', async () => {
    stubFetch(() => ({ status: 200, body: { ...structuredClone(goodBootstrap), manifest: 'nope' } }));
    await expect(new ApiDataService().init()).rejects.toMatchObject({ code: 'invalid_payload' });
  });
});

describe('schema-version guard (WS1-R3)', () => {
  it('current version is a no-op migration', () => {
    const m = { domNodes: {} };
    const out = migrateManifest(m, CURRENT_SCHEMA_VERSION);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.manifest).toBe(m); // untouched, not cloned
  });

  it('refuses a manifest newer than this build (never silently loaded)', () => {
    expect(() => assertSupportedSchema(CURRENT_SCHEMA_VERSION + 1)).toThrowError(/newer than this build/);
    try {
      migrateManifest({}, CURRENT_SCHEMA_VERSION + 1);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as DataServiceError).code).toBe('unsupported_schema');
    }
  });

  it('refuses invalid version numbers', () => {
    expect(() => assertSupportedSchema(0)).toThrowError(DataServiceError);
    expect(() => assertSupportedSchema(1.5)).toThrowError(DataServiceError);
  });

  it('init refuses a future-schema bootstrap end-to-end', async () => {
    const future = structuredClone(goodBootstrap);
    future.project.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
    stubFetch(() => ({ status: 200, body: future }));
    await expect(new ApiDataService().init()).rejects.toMatchObject({ code: 'unsupported_schema' });
  });

  it('importProject refuses a future-schema document BEFORE any network write', async () => {
    const spy = stubFetch(() => ({ status: 200, body: { draftVersion: 2 } }));
    const doc = {
      format: 'build-studio-project' as const,
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      exportedAt: '2026-07-20T00:00:00Z',
      project: { slug: 'fleet-story', name: 'Fleet Story' },
      manifest: {},
    };
    await expect(new ApiDataService().importProject(doc)).rejects.toMatchObject({
      code: 'unsupported_schema',
    });
    expect(spy).not.toHaveBeenCalled(); // draft never overwritten
  });
});

describe('conflict surfacing (WS1-R5, FR-103/FR-113)', () => {
  it('notifies the registered handler once per distinct server version', async () => {
    stubFetch((url) =>
      url.endsWith('/api/bootstrap')
        ? { status: 200, body: structuredClone(goodBootstrap) }
        : { status: 409, body: { error: 'conflict', draftVersion: 9 } },
    );
    const boot = await initData();
    expect(boot.source).toBe('postgresql');

    const handler = vi.fn();
    registerConflictHandler(handler);

    syncDraft({ domNodes: {} });
    syncDraft({ domNodes: {} }); // same server version — must not re-notify
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(9);
  });
});
