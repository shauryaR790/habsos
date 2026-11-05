import { readFileSync, writeFileSync } from 'node:fs';
import { BlobNotFoundError, get, head, put } from '@vercel/blob';
import { db } from './db';

const KEY = 'habsos.db';
let seen = '';
let blobWritable: boolean | null = null;

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isBlobUnavailable(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: string }).name) : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === 'BlobStoreSuspendedError'
    || /suspended/i.test(message)
    || /403 Forbidden/i.test(message)
    || /Failed to fetch blob/i.test(message)
  );
}

export async function pullDatabase(dest: string): Promise<'written' | 'current' | 'absent'> {
  if (!blobEnabled() || blobWritable === false) return 'absent';
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
    blobWritable = true;
    return 'written';
  } catch (error) {
    if (error instanceof BlobNotFoundError) return 'absent';
    if (isBlobUnavailable(error)) {
      blobWritable = false;
      console.error('Shared database blob unavailable — using local SQLite only.', error);
      return 'absent';
    }
    console.error('Could not read the shared database.', error);
    return 'absent';
  }
}

export async function pushDatabase(src: string) {
  if (!blobEnabled() || blobWritable === false) return;
  try {
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
    blobWritable = true;
  } catch (error) {
    if (isBlobUnavailable(error)) {
      blobWritable = false;
      console.error('Shared database blob unavailable — writes stay on this instance only.', error);
      return;
    }
    console.error('Could not write the shared database.', error);
  }
}
