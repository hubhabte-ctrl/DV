import createClient from 'openapi-fetch';
import type { paths } from './api.generated';
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

// The SaaS backend does not serve frontend component templates, so we still
// fetch the UI bootstrap from the asset server/dev server.
async function fetchBootstrap(): Promise<BootstrapData> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new DataServiceError('http', `bootstrap: HTTP ${res.status}`, { status: res.status });
  return validateBootstrap(await res.json());
}

export class RestAdapter implements DataService {
  private draftVersion = 0;
  private client = createClient<paths>({
    baseUrl: 'http://localhost/v1',
    fetch: async (request: Request) => {
      const urlStr = request.url;
      const options = {
        method: request.method,
        headers: request.headers,
        body: request.body ? await request.clone().text() : undefined,
      };
      const res = await fetch(urlStr, options);
      if (!res.headers) {
        (res as any).headers = { get: (key: string) => key.toLowerCase() === 'content-type' ? 'application/json' : null };
      }
      if (!res.text && res.json) {
        const bodyStr = JSON.stringify(await res.json());
        (res as any).text = async () => bodyStr;
        (res as any).json = async () => JSON.parse(bodyStr);
      }
      if (!res.clone) {
        (res as any).clone = () => res;
      }
      return res;
    }
  });

  async init(): Promise<BootstrapData> {
    const data = await fetchBootstrap();
    data.manifest = migrateManifest(data.manifest, data.project.schemaVersion).manifest;
    this.draftVersion = data.project.draftVersion;
    return data;
  }

  async saveDraft(manifest: unknown): Promise<{ draftVersion: number }> {
    const res = await this.client.PUT('/projects/{projectId}/draft', {
      params: { path: { projectId: PROJECT_SLUG }, header: { 'If-Match': String(this.draftVersion) } },
      // openapi-fetch types might not have body typed if we didn't specify it in openapi.yaml,
      // so we use any to bypass strict typing for the body in this MVP adapter.
      body: { manifest, baseVersion: this.draftVersion } as any,
    });

    if (res.error) {
      if (res.response.status === 409) {
        const errBody = res.error as any;
        throw new DataServiceError('conflict', 'draft version conflict (FR-103)', {
          status: 409,
          draftVersion: errBody?.draftVersion,
        });
      }
      throw new DataServiceError('http', `data service: HTTP ${res.response.status}`, { status: res.response.status });
    }

    const out = validateDraftAck(res.data);
    this.draftVersion = out.draftVersion;
    return out;
  }

  async resetToSeed(): Promise<{ manifest: unknown; draftVersion: number }> {
    // Reset to seed is not in the OpenAPI spec, as it's a dev/prototype endpoint.
    // We fall back to the /api endpoint for contract parity.
    const res = await fetch(`/api/projects/${PROJECT_SLUG}/reset`, { method: 'POST' });
    if (!res.ok) throw new DataServiceError('http', `reset: HTTP ${res.status}`, { status: res.status });
    const out = validateReset(await res.json());
    this.draftVersion = out.draftVersion;
    return out;
  }

  async exportProject(): Promise<ProjectInterchange> {
    // Export is not in OpenAPI v1, fall back to /api endpoint
    const res = await fetch(`/api/projects/${PROJECT_SLUG}/export`);
    if (!res.ok) throw new DataServiceError('http', `export: HTTP ${res.status}`, { status: res.status });
    return validateInterchange(await res.json());
  }

  async importProject(doc: ProjectInterchange): Promise<{ draftVersion: number }> {
    validateInterchange(doc);
    assertSupportedSchema(doc.schemaVersion);
    const res = await fetch(`/api/projects/${PROJECT_SLUG}/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(doc),
    });
    if (!res.ok) throw new DataServiceError('http', `import: HTTP ${res.status}`, { status: res.status });
    const out = validateDraftAck(await res.json());
    this.draftVersion = out.draftVersion;
    return out;
  }
}
