/**
 * WS1 service-layer tests (dev plan WS1.6):
 *  - seed integrity (the offline fallback must always be coherent)
 *  - appData registry override behavior (PostgreSQL bootstrap supersedes seed)
 *  - ApiDataService ↔ DataService contract incl. FR-103 conflict handling
 */
// @ts-ignore
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  seedBootstrap,
  seedComponentLibrary,
  seedComponentTemplates,
  seedInspectorSchema,
  seedManifest,
} from './seed';
import {
  getComponentLibrary,
  getComponentTemplates,
  getDataSource,
  getInspectorSchema,
  setAppData,
} from './appData';
import { ApiDataService } from './api';
import { RestAdapter } from './rest';
import type { BootstrapData } from '@bs/schema';

describe('seed integrity (offline fallback)', () => {
  it('manifest carries the core document collections', () => {
    const m = seedManifest as Record<string, unknown>;
    expect(m.sections ?? m.domRootOrder ?? m.domNodes).toBeTruthy();
    expect(m.domNodes).toBeTypeOf('object');
  });

  it('toolbox covers the FR-120 MVP set with unique ids', () => {
    const ids = seedComponentLibrary.toolbox.map((t) => t.id);
    expect(ids.length).toBeGreaterThanOrEqual(16);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of seedComponentLibrary.toolbox) {
      expect(t.id).toMatch(/^cmp-/);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it('every instantiation template belongs to a known toolbox id', () => {
    const ids = new Set(seedComponentLibrary.toolbox.map((t) => t.id));
    for (const key of Object.keys(seedComponentTemplates)) {
      if (key === 'comment') continue; // file-level metadata, not a template
      expect(ids.has(key), `template '${key}' has no toolbox entry`).toBe(true);
    }
  });

  it('inspector schema exposes dom and scene groups', () => {
    expect(Array.isArray(seedInspectorSchema.dom)).toBe(true);
    expect(Array.isArray(seedInspectorSchema.scene)).toBe(true);
  });

  it('seedBootstrap clones the manifest (no shared mutable state)', () => {
    const a = seedBootstrap();
    const b = seedBootstrap();
    expect(a.manifest).not.toBe(b.manifest);
    expect(a.source).toBe('seed');
  });
});

describe('appData registry', () => {
  it('overrides seed values when the PostgreSQL bootstrap arrives', () => {
    const boot: BootstrapData = {
      source: 'postgresql',
      project: { slug: 'fleet-story', name: 'Fleet Story', schemaVersion: 1, draftVersion: 7 },
      manifest: {},
      componentDefs: { toolbox: [{ id: 'cmp-x', label: 'X', description: '' }] },
      componentTemplates: { 'cmp-x': { type: 'container' } },
      inspectorSchema: { dom: [], scene: [] },
    };
    setAppData(boot);
    expect(getDataSource()).toBe('postgresql');
    expect(getComponentLibrary().toolbox).toHaveLength(1);
    expect(getComponentTemplates()['cmp-x']).toEqual({ type: 'container' });
    expect(getInspectorSchema().dom).toEqual([]);
    // restore seed state for other suites
    setAppData(seedBootstrap());
    expect(getDataSource()).toBe('seed');
  });
});

[
  { name: 'ApiDataService', Adapter: ApiDataService },
  { name: 'RestAdapter', Adapter: RestAdapter }
].forEach(({ name, Adapter }) => {
describe(`${name} contract (mocked transport)`, () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      const { status, body } = handler(String(url), init);
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      } as Response);
    });
  }

  it('init loads the bootstrap and tracks draftVersion for optimistic saves', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    stubFetch((url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/api/bootstrap')) {
        return {
          status: 200,
          body: {
            source: 'postgresql',
            project: { slug: 'fleet-story', name: 'Fleet Story', schemaVersion: 1, draftVersion: 3 },
            manifest: { domNodes: {} },
            componentDefs: { toolbox: [] },
            componentTemplates: {},
            inspectorSchema: { dom: [], scene: [] },
          },
        };
      }
      return { status: 200, body: { draftVersion: 4 } };
    });

    const svc = new Adapter();
    const boot = await svc.init();
    expect(boot.project.draftVersion).toBe(3);

    await svc.saveDraft({ domNodes: {} });
    const save = calls.find((c) => c.url.includes('/draft'));
    expect((save?.body as { baseVersion: number }).baseVersion).toBe(3); // FR-103
  });

  it('surfaces a typed conflict on 409 (FR-103 — never silently merged)', async () => {
    stubFetch((url) =>
      url.endsWith('/api/bootstrap')
        ? {
            status: 200,
            body: {
              source: 'postgresql',
              project: { slug: 'fleet-story', name: 'Fleet Story', schemaVersion: 1, draftVersion: 1 },
              manifest: {},
              componentDefs: { toolbox: [] },
              componentTemplates: {},
              inspectorSchema: { dom: [], scene: [] },
            },
          }
        : { status: 409, body: { error: 'version conflict', draftVersion: 9 } },
    );

    const svc = new Adapter();
    await svc.init();
    await expect(svc.saveDraft({})).rejects.toMatchObject({ code: 'conflict', draftVersion: 9 });
  });

  it('exportProject returns the interchange document shape', async () => {
    stubFetch((url) =>
      url.endsWith('/export')
        ? {
            status: 200,
            body: {
              format: 'build-studio-project',
              schemaVersion: 1,
              exportedAt: '2026-07-20T00:00:00Z',
              project: { slug: 'fleet-story', name: 'Fleet Story' },
              manifest: { domNodes: {} },
            },
          }
        : { status: 200, body: {} },
    );
    const doc = await new Adapter().exportProject();
    expect(doc.format).toBe('build-studio-project');
    expect(doc.manifest).toBeTruthy();
  });
});
});
