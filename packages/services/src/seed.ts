/**
 * Seed access — the ONLY module in src/ permitted to import db/seed/** (FR-115
 * data gate; dev plan WS1.7). Provides the offline/test fallback state and the
 * engine's boot seed. At runtime the PostgreSQL bootstrap (services/api.ts)
 * supersedes these values; in Node tests and offline dev they keep the editor
 * functional (FR-113 offline posture).
 */
// src/services/ is the sanctioned sole seed importer (FR-115 gate exempts this directory).
import manifestJson from '../../../db/seed/manifest.json';
import blankManifestJson from '../../../db/seed/blank-manifest.json';
import assetsJson from '../../../db/seed/assets.json';
import componentsJson from '../../../db/seed/components.json';
import componentTemplatesJson from '../../../db/seed/components-templates.json';
import inspectorSchemaJson from '../../../db/seed/inspector-schema.json';

import type { BootstrapData, ComponentLibrary, ComponentTemplates, InspectorSchema } from '@bs/schema';

export const seedManifest: unknown = manifestJson;
export const seedBlankManifest: unknown = blankManifestJson;

export const seedAssets: { assets: Array<Record<string, unknown>>; categories: string[] } =
  assetsJson as never;

export const seedComponentLibrary: ComponentLibrary = componentsJson as unknown as ComponentLibrary;

export const seedComponentTemplates: ComponentTemplates =
  componentTemplatesJson as unknown as ComponentTemplates;

export const seedInspectorSchema: InspectorSchema = inspectorSchemaJson as unknown as InspectorSchema;

/** Full offline bootstrap payload (source: 'seed'). */
export function seedBootstrap(): BootstrapData {
  return {
    source: 'seed',
    project: { slug: 'my-project', name: 'Untitled Project', schemaVersion: 1, draftVersion: 0 },
    manifest: structuredClone(blankManifestJson) as unknown,
    componentDefs: seedComponentLibrary,
    componentTemplates: seedComponentTemplates,
    inspectorSchema: seedInspectorSchema,
  };
}
