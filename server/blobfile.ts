import { readFileSync, writeFileSync } from 'node:fs';
import { BlobNotFoundError, get, head, put } from '@vercel/blob';
import { db } from './db';

const KEY = 'habsos.db';
let seen = '';

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function pullDatabase(dest: string): Promise<'written' | 'current' | 'absent'> {
  if (!blobEnabled()) return 'absent';
  try {
    const meta = await head(KEY);
    if (meta.etag && meta.etag === seen) return 'current';
    const downloaded = await get(KEY, { access: 'private', useCache: false, ifNoneMatch: seen || undefined });
    if (!downloaded) return 'absent';
    if (downloaded.statusCode === 304) {
      seen = meta.etag;
      return 'current';
    }
    const bytes = Buffer.from(await new Response(downloaded.stream).arrayBuffer());
    writeFileSync(`${dest}.incoming`, bytes);
    seen = downloaded.blob.etag || meta.etag;
    return 'written';
  } catch (error) {
    if (error instanceof BlobNotFoundError) return 'absent';
    console.error('Could not read the shared database.', error);
    return 'absent';
  }
}

export async function pushDatabase(src: string) {
  if (!blobEnabled()) return;
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    /* delete-journal mode has nothing to checkpoint */
  }
  const saved = await put(KEY, readFileSync(src), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/octet-stream',
    cacheControlMaxAge: 60,
  });
  if (saved.etag) seen = saved.etag;
}
