/**
 * Application-data registry (WS1 — F-C3 remediation).
 *
 * Shell components read editor data (toolbox defs, node templates, inspector
 * schema) through these getters — never from JSON or the database directly
 * (FR-115). The registry boots from the seed fallback and is overwritten by
 * the PostgreSQL bootstrap before React mounts (main.tsx awaits init).
 */
import type { BootstrapData, ComponentLibrary, ComponentTemplates, InspectorSchema } from '@bs/schema';
import { seedComponentLibrary, seedComponentTemplates, seedInspectorSchema } from './seed';

let componentLibrary: ComponentLibrary = seedComponentLibrary;
let componentTemplates: ComponentTemplates = seedComponentTemplates;
let inspectorSchema: InspectorSchema = seedInspectorSchema;
let source: BootstrapData['source'] = 'seed';

export function setAppData(data: BootstrapData): void {
  componentLibrary = data.componentDefs;
  componentTemplates = data.componentTemplates;
  inspectorSchema = data.inspectorSchema;
  source = data.source;
}

export function getComponentLibrary(): ComponentLibrary {
  return componentLibrary;
}

export function getComponentTemplates(): ComponentTemplates {
  return componentTemplates;
}

export function getInspectorSchema(): InspectorSchema {
  return inspectorSchema;
}

/** 'postgresql' when served by the dev database, 'seed' in offline/test fallback. */
export function getDataSource(): BootstrapData['source'] {
  return source;
}
