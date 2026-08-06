/**
 * DataService boundary validation + typed errors (WS1-R2, dev plan WS1.4).
 *
 * Every payload crossing the service boundary (bootstrap, draft-save ack,
 * reset, interchange) is structurally validated here — malformed server
 * responses surface as typed `DataServiceError`s instead of undefined
 * behavior deep inside the editor. Hand-rolled (no runtime dependency);
 * the checks mirror the `@bs/schema` contract field-for-field.
 */
import type { BootstrapData, ProjectInterchange } from '@bs/schema';

export type DataServiceErrorCode =
  | 'invalid_payload' // response/document failed structural validation
  | 'conflict' // FR-103 optimistic-concurrency conflict (409)
  | 'http' // non-OK transport status
  | 'unsupported_schema'; // manifest schemaVersion newer than this build (WS1-R3)

export class DataServiceError extends Error {
  readonly code: DataServiceErrorCode;
  readonly status?: number;
  readonly draftVersion?: number;
  /** dotted paths of the fields that failed validation */
  readonly issues?: string[];

  constructor(
    code: DataServiceErrorCode,
    message: string,
    extra: { status?: number; draftVersion?: number; issues?: string[] } = {},
  ) {
    super(message);
    this.name = 'DataServiceError';
    this.code = code;
    this.status = extra.status;
    this.draftVersion = extra.draftVersion;
    this.issues = extra.issues;
  }
}

/* ── structural helpers (issues collected, not thrown one-by-one) ── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Check {
  issues: string[] = [];
  rec(v: unknown, path: string): v is Record<string, unknown> {
    if (isRecord(v)) return true;
    this.issues.push(`${path}: expected object`);
    return false;
  }
  str(v: unknown, path: string): v is string {
    if (typeof v === 'string' && v.length > 0) return true;
    this.issues.push(`${path}: expected non-empty string`);
    return false;
  }
  num(v: unknown, path: string): v is number {
    if (typeof v === 'number' && Number.isFinite(v)) return true;
    this.issues.push(`${path}: expected finite number`);
    return false;
  }
  fail(kind: string): never {
    throw new DataServiceError('invalid_payload', `${kind} failed validation: ${this.issues.join('; ')}`, {
      issues: this.issues,
    });
  }
}

/** Validate the full bootstrap payload (GET /api/bootstrap). */
export function validateBootstrap(v: unknown): BootstrapData {
  const c = new Check();
  if (!c.rec(v, '$')) c.fail('bootstrap');
  const b = v as Record<string, unknown>;
  if (b.source !== 'postgresql' && b.source !== 'seed') c.issues.push('source: expected postgresql|seed');
  if (c.rec(b.project, 'project')) {
    const p = b.project as Record<string, unknown>;
    c.str(p.slug, 'project.slug');
    c.str(p.name, 'project.name');
    c.num(p.schemaVersion, 'project.schemaVersion');
    c.num(p.draftVersion, 'project.draftVersion');
  }
  c.rec(b.manifest, 'manifest');
  if (c.rec(b.componentDefs, 'componentDefs')) {
    const toolbox = (b.componentDefs as Record<string, unknown>).toolbox;
    if (!Array.isArray(toolbox)) c.issues.push('componentDefs.toolbox: expected array');
    else
      toolbox.forEach((t, i) => {
        if (c.rec(t, `componentDefs.toolbox[${i}]`)) {
          c.str((t as Record<string, unknown>).id, `componentDefs.toolbox[${i}].id`);
        }
      });
  }
  c.rec(b.componentTemplates, 'componentTemplates');
  c.rec(b.inspectorSchema, 'inspectorSchema');
  if (c.issues.length) c.fail('bootstrap');
  return v as BootstrapData;
}

/** Validate a draft-save / import acknowledgement (`{ draftVersion }`). */
export function validateDraftAck(v: unknown): { draftVersion: number } {
  const c = new Check();
  if (!c.rec(v, '$') || !c.num((v as Record<string, unknown>).draftVersion, 'draftVersion'))
    c.fail('draft ack');
  return v as { draftVersion: number };
}

/** Validate a reset-to-seed response (`{ manifest, draftVersion }`). */
export function validateReset(v: unknown): { manifest: unknown; draftVersion: number } {
  const c = new Check();
  if (c.rec(v, '$')) {
    const r = v as Record<string, unknown>;
    c.rec(r.manifest, 'manifest');
    c.num(r.draftVersion, 'draftVersion');
  }
  if (c.issues.length) c.fail('reset');
  return v as { manifest: unknown; draftVersion: number };
}

/** Validate a `build-studio-project` interchange document (export/import). */
export function validateInterchange(v: unknown): ProjectInterchange {
  const c = new Check();
  if (!c.rec(v, '$')) c.fail('interchange');
  const d = v as Record<string, unknown>;
  if (d.format !== 'build-studio-project') c.issues.push("format: expected 'build-studio-project'");
  c.num(d.schemaVersion, 'schemaVersion');
  c.str(d.exportedAt, 'exportedAt');
  if (c.rec(d.project, 'project')) {
    const p = d.project as Record<string, unknown>;
    c.str(p.slug, 'project.slug');
    c.str(p.name, 'project.name');
  }
  c.rec(d.manifest, 'manifest');
  if (c.issues.length) c.fail('interchange');
  return v as ProjectInterchange;
}
