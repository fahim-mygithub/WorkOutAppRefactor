/**
 * Test double for the Firestore REST API at the `fetch` level, so tests run
 * the real client (URLs, update masks, preconditions, runQuery) against an
 * in-memory store. Records every request path for scoping assertions.
 */
import { createFirestoreRest, type FirestoreRest, type FsDocument } from '../firestore';
import { fromFields, toFields, type FsFields, type FsValue } from '../firestoreValue';

const PREFIX = '/v1/projects/test-project/databases/(default)/documents';

interface Stored { fields: FsFields; createTime: string; updateTime: string }

export interface RecordedRequest { method: string; path: string[]; query: URLSearchParams; body?: unknown }

const err = (status: number, reason: string, message = reason) =>
  new Response(JSON.stringify({ error: { code: status, status: reason, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const ok = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

function setPath(fields: FsFields, path: string[], value: FsValue | undefined) {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    if (value === undefined) delete fields[head];
    else fields[head] = value;
    return;
  }
  const cur = fields[head];
  const map = cur && 'mapValue' in cur ? cur : { mapValue: { fields: {} as FsFields } };
  map.mapValue.fields ??= {};
  setPath(map.mapValue.fields, rest, value);
  fields[head] = map;
}

function getPath(fields: FsFields | undefined, path: string[]): FsValue | undefined {
  const [head, ...rest] = path;
  const v = fields?.[head];
  if (!v || rest.length === 0) return v;
  return 'mapValue' in v ? getPath(v.mapValue.fields, rest) : undefined;
}

function sortKey(v: FsValue | undefined): string | number {
  if (!v) return '';
  if ('timestampValue' in v) return v.timestampValue;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  return '';
}

export class FakeFirestore {
  readonly docs = new Map<string, Stored>();
  readonly requests: RecordedRequest[] = [];
  private clock = Date.parse('2026-10-30T12:00:00.000Z');
  private nextId = 1;
  /** Runs before a PATCH is applied, e.g. to simulate a concurrent write from the phone. */
  beforePatch?: (path: string[]) => void;

  private tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  /** Seed or overwrite a document from plain data (`Date` -> timestamp). */
  put(path: string[], data: Record<string, unknown>) {
    const now = this.tick();
    const prev = this.docs.get(path.join('/'));
    this.docs.set(path.join('/'), { fields: toFields(data), createTime: prev?.createTime ?? now, updateTime: now });
  }

  /** A stored document decoded the way `fromFirestore` would (timestamps as ISO strings). */
  read(path: string[]): Record<string, unknown> | undefined {
    const d = this.docs.get(path.join('/'));
    return d ? fromFields(d.fields) : undefined;
  }

  raw(path: string[]): FsFields | undefined {
    return this.docs.get(path.join('/'))?.fields;
  }

  private asDoc(key: string, d: Stored): FsDocument {
    return { name: `projects/test-project/databases/(default)/documents/${key}`, fields: d.fields, createTime: d.createTime, updateTime: d.updateTime };
  }

  readonly fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.pathname.startsWith(PREFIX)) return err(400, 'INVALID_ARGUMENT', `bad url ${url.pathname}`);
    if ((init.headers as Record<string, string>)?.authorization !== 'Bearer test-token') return err(401, 'UNAUTHENTICATED');
    let rest = url.pathname.slice(PREFIX.length + 1);
    const isQuery = rest.endsWith(':runQuery');
    if (isQuery) rest = rest.slice(0, -':runQuery'.length);
    const path = rest.split('/').map(decodeURIComponent);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ method, path, query: url.searchParams, body });
    const key = path.join('/');

    if (isQuery) {
      const q = body.structuredQuery;
      const collection = `${key}/${q.from[0].collectionId}/`;
      const field: string[] = q.orderBy[0].field.fieldPath.split('.');
      const dir = q.orderBy[0].direction === 'DESCENDING' ? -1 : 1;
      const rows = [...this.docs.entries()]
        .filter(([k]) => k.startsWith(collection) && !k.slice(collection.length).includes('/'))
        .filter(([, d]) => getPath(d.fields, field) !== undefined)
        .sort(([, a], [, b]) => {
          const x = sortKey(getPath(a.fields, field));
          const y = sortKey(getPath(b.fields, field));
          return x < y ? -dir : x > y ? dir : 0;
        })
        .slice(q.offset ?? 0, (q.offset ?? 0) + q.limit);
      const readTime = this.tick();
      return ok(rows.length ? rows.map(([k, d]) => ({ document: this.asDoc(k, d), readTime })) : [{ readTime }]);
    }

    if (method === 'GET') {
      const d = this.docs.get(key);
      return d ? ok(this.asDoc(key, d)) : err(404, 'NOT_FOUND');
    }

    if (method === 'POST') {
      const id = `auto${String(this.nextId++).padStart(16, '0')}`;
      const now = this.tick();
      const d = { fields: body.fields ?? {}, createTime: now, updateTime: now };
      this.docs.set(`${key}/${id}`, d);
      return ok(this.asDoc(`${key}/${id}`, d));
    }

    if (method === 'PATCH') {
      this.beforePatch?.(path);
      const existing = this.docs.get(key);
      const exists = url.searchParams.get('currentDocument.exists');
      const updateTime = url.searchParams.get('currentDocument.updateTime');
      if (exists === 'true' && !existing) return err(404, 'NOT_FOUND');
      if (exists === 'false' && existing) return err(409, 'ALREADY_EXISTS');
      if (updateTime && existing?.updateTime !== updateTime) return err(400, 'FAILED_PRECONDITION');
      const mask = url.searchParams.getAll('updateMask.fieldPaths');
      let fields: FsFields;
      if (mask.length) {
        fields = structuredClone(existing?.fields ?? {});
        for (const fp of mask) {
          const segs = fp.split('.');
          setPath(fields, segs, getPath(body.fields, segs));
        }
      } else {
        fields = body.fields ?? {};
      }
      const now = this.tick();
      const d = { fields, createTime: existing?.createTime ?? now, updateTime: now };
      this.docs.set(key, d);
      return ok(this.asDoc(key, d));
    }

    return err(400, 'INVALID_ARGUMENT', `unsupported ${method}`);
  };

  client(): FirestoreRest {
    return createFirestoreRest('test-project', async () => 'test-token', this.fetch);
  }
}
