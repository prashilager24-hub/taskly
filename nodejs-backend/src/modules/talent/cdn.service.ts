import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

interface SwiftToken {
  token: string;
  storageUrl: string;
  expiresAt: number; // ms timestamp
}

let cachedToken: SwiftToken | null = null;

async function getSwiftToken(): Promise<SwiftToken> {
  // reuse token if still valid (expire 5 min early)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  if (!env.CDN_USERNAME || !env.CDN_API_KEY) {
    throw new Error('CDN credentials not configured (CDN_USERNAME / CDN_API_KEY missing)');
  }

  const res = await fetch(env.CDN_AUTH_URL, {
    method: 'GET',
    headers: {
      'X-Auth-User': env.CDN_USERNAME,
      'X-Auth-Key': env.CDN_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Swift auth failed: ${res.status} ${res.statusText}`);
  }

  const token = res.headers.get('X-Auth-Token');
  const storageUrl = res.headers.get('X-Storage-Url');

  if (!token || !storageUrl) {
    throw new Error('Swift auth response missing X-Auth-Token or X-Storage-Url');
  }

  cachedToken = {
    token,
    storageUrl,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000, // Swift tokens typically last 24h
  };

  return cachedToken;
}

export interface UploadResult {
  cdnUrl: string;   // public delivery URL
  objectPath: string; // container/filename
}

/**
 * Upload a file buffer to BlazingCDN via Swift PUT.
 * Returns the public CDN URL.
 */
export async function uploadToCDN(
  buffer: Buffer,
  originalName: string,
  prefix: 'resumes' | 'jd',
  mimeType: string,
): Promise<UploadResult> {
  const ext = path.extname(originalName).toLowerCase();
  const objectName = `${prefix}/${prefix}-${Date.now()}${ext}`;

  const { token, storageUrl } = await getSwiftToken();
  const url = `${storageUrl}/${env.CDN_CONTAINER}/${objectName}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Auth-Token': token,
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
    // @ts-ignore — Node fetch doesn't need duplex flag but types may complain
    duplex: 'half',
  });

  if (!res.ok) {
    throw new Error(`CDN upload failed: ${res.status} ${res.statusText}`);
  }

  // Public delivery URL: https://cdn15359691.blazingcdn.net/<container>/<object>
  const cdnUrl = `${env.CDN_PUBLIC_URL}/${env.CDN_CONTAINER}/${objectName}`;
  logger.info('[cdn] Uploaded %s → %s', objectName, cdnUrl);

  return { cdnUrl, objectPath: `${env.CDN_CONTAINER}/${objectName}` };
}

/**
 * Delete an object from CDN by its object path (container/filename).
 */
export async function deleteFromCDN(objectPath: string): Promise<void> {
  try {
    const { token, storageUrl } = await getSwiftToken();
    const url = `${storageUrl}/${objectPath}`;
    await fetch(url, { method: 'DELETE', headers: { 'X-Auth-Token': token } });
    logger.info('[cdn] Deleted %s', objectPath);
  } catch (err) {
    logger.warn({ err }, '[cdn] Failed to delete %s', objectPath);
  }
}

/** Returns true when CDN credentials are set */
export function cdnConfigured(): boolean {
  return !!(env.CDN_USERNAME && env.CDN_API_KEY);
}
