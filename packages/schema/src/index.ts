/**
 * @bs/schema — canonical schema layer (WS2-1, Doc 04 §1 package boundaries).
 *
 * First extraction of the workspace split (dev plan WS2, strangler-fig):
 * pure types and constants only — this package MUST stay dependency-free
 * (no react, no three, no engine imports; enforced by lint/CI).
 *
 * Contents (pure-moved from src/services/types.ts + migrations.ts, IL-11
 * behavior-identical):
 *  - the manifest schema version this build reads/writes;
 *  - the DataService contract (ADR-005/FR-115): PostgreSQL is the source of
 *    truth, the UI consumes application data exclusively through this
 *    contract. Adapters: ApiDataService (dev, src/services) and the WS4
 *    RestAdapter (Doc 06 §6) — both must pass the same contract test suite.
 */

/** Manifest schema version this build reads and writes (FR-115; WS1-R3
 *  migration registry lives in src/services/migrations.ts). */
export const CURRENT_SCHEMA_VERSION = 1;

export interface ToolboxItem {
  id: string;
  label: string;
  description: string;
}

export interface ComponentLibrary {
  toolbox: ToolboxItem[];
}

/** DomNode instantiation templates keyed by component id (FR-120). */
export type ComponentTemplates = Record<string, unknown>;

/** Schema-driven inspector definition (PRD-F-17); groups are cast at use sites. */
export interface InspectorSchema {
  dom: unknown;
  scene: unknown;
  [key: string]: unknown;
}

export interface ProjectInfo {
  slug: string;
  name: string;
  schemaVersion: number;
  draftVersion: number;
}

/** The init payload — everything the editor needs before first render. */
export interface BootstrapData {
  source: 'postgresql' | 'seed';
  project: ProjectInfo;
  manifest: unknown;
  componentDefs: ComponentLibrary;
  componentTemplates: ComponentTemplates;
  inspectorSchema: InspectorSchema;
}

/** Versioned interchange document (export/import; future REST draft payload). */
export interface ProjectInterchange {
  format: 'build-studio-project';
  schemaVersion: number;
  exportedAt: string;
  project: { slug: string; name: string };
  manifest: unknown;
}

export interface DataService {
  /** Load the full editor bootstrap from the source of truth. */
  init(): Promise<BootstrapData>;
  /** Persist the draft manifest (optimistic concurrency per FR-103). */
  saveDraft(manifest: unknown): Promise<{ draftVersion: number }>;
  /** Reset the working draft to the starter template (Objective.md reset-to-seed). */
  resetToSeed(): Promise<{ manifest: unknown; draftVersion: number }>;
  /** Export the project as an interchange document. */
  exportProject(): Promise<ProjectInterchange>;
  /** Replace the draft from an interchange document. */
  importProject(doc: ProjectInterchange): Promise<{ draftVersion: number }>;
}
