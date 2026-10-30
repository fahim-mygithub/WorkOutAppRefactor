/**
 * Minimal Firestore REST client (v1). Paths are relative to
 * `projects/{p}/databases/(default)/documents`; each segment is URL-encoded.
 * Callers never build paths from tool input — see `userData.ts`.
 */
import type { FsFields } from './firestoreValue';
import type { AccessTokenSource } from './googleAuth';

export interface FsDocument {
  name: string;
  fields?: FsFields;
  createTime?: string;
  updateTime?: string;
}

export class FirestoreError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'FirestoreError';
  }

  /** A failed precondition or aborted transaction: re-read and try again. */
  get isConflict(): boolean {
    return this.reason === 'FAILED_PRECONDITION' || this.reason === 'ABORTED' || this.status === 409;
  }
}

export interface PatchOptions {
  /** Field paths to write; other fields are left alone. Omit to replace the document. */
  mask?: string[];
  /** Precondition: the document must (true) or must not (false) exist. */
  exists?: boolean;
  /** Precondition: the document was last written at exactly this time. */
  updateTime?: string;
}

export interface QueryOptions {
  orderBy: string;
  direction: 'ASCENDING' | 'DESCENDING';
  limit: number;
  offset?: number;
}

export interface FirestoreRest {
  get(path: string[]): Promise<FsDocument | null>;
  create(collection: string[], fields: FsFields): Promise<FsDocument>;
  patch(path: string[], fields: FsFields, opts?: PatchOptions): Promise<FsDocument>;
  query(parent: string[], collectionId: string, opts: QueryOptions): Promise<FsDocument[]>;
}

export const docId = (doc: FsDocument): string => doc.name.slice(doc.name.lastIndexOf('/') + 1);

export function createFirestoreRest(
  projectId: string,
  getToken: AccessTokenSource,
  fetchImpl: typeof fetch = fetch,
): FirestoreRest {
  const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const url = (segments: string[]) => [root, ...segments.map(encodeURIComponent)].join('/');

  async function call(target: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    const res = await fetchImpl(target, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    if (res.ok || res.status === 404) return res;
    let reason = 'UNKNOWN';
    let message = `Firestore request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { status?: string; message?: string } };
      reason = body.error?.status ?? reason;
      message = body.error?.message ?? message;
    } catch {
      /* not JSON */
    }
    throw new FirestoreError(res.status, reason, message);
  }

  return {
    async get(path) {
      const res = await call(url(path));
      if (res.status === 404) return null;
      return (await res.json()) as FsDocument;
    },
    async create(collection, fields) {
      const res = await call(url(collection), { method: 'POST', body: JSON.stringify({ fields }) });
      if (res.status === 404) throw new FirestoreError(404, 'NOT_FOUND', 'Collection parent not found');
      return (await res.json()) as FsDocument;
    },
    async patch(path, fields, opts = {}) {
      const params = new URLSearchParams();
      for (const f of opts.mask ?? []) params.append('updateMask.fieldPaths', f);
      if (opts.exists !== undefined) params.set('currentDocument.exists', String(opts.exists));
      if (opts.updateTime) params.set('currentDocument.updateTime', opts.updateTime);
      const qs = params.toString();
      const res = await call(`${url(path)}${qs ? `?${qs}` : ''}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
      if (res.status === 404) throw new FirestoreError(404, 'NOT_FOUND', 'Document not found');
      return (await res.json()) as FsDocument;
    },
    async query(parent, collectionId, opts) {
      const structuredQuery = {
        from: [{ collectionId }],
        orderBy: [{ field: { fieldPath: opts.orderBy }, direction: opts.direction }],
        limit: opts.limit,
        ...(opts.offset ? { offset: opts.offset } : {}),
      };
      const res = await call(`${url(parent)}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
      if (res.status === 404) return [];
      const rows = (await res.json()) as { document?: FsDocument }[];
      return rows.flatMap((r) => (r.document ? [r.document] : []));
    },
  };
}
