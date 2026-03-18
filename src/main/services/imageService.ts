import { execFile } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

// Cache directory for converted images
const CACHE_DIR = path.join(app.getPath('userData'), 'image-cache');

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Convert HEIC image to JPEG using macOS sips command
 * Returns path to converted JPEG, or original path if conversion fails
 */
export async function convertHeicToJpeg(heicPath: string): Promise<string> {
  if (!heicPath) return heicPath;

  // Check if already JPEG
  const ext = path.extname(heicPath).toLowerCase();
  if (ext !== '.heic' && ext !== '.heif') {
    return heicPath;
  }

  // Check if source file exists
  if (!fs.existsSync(heicPath)) {
    return heicPath;
  }

  ensureCacheDir();

  // Create cache filename based on original path hash
  const hash = Buffer.from(heicPath).toString('base64').replace(/[/+=]/g, '_');
  const cachedPath = path.join(CACHE_DIR, `${hash}.jpg`);

  // Return cached version if exists
  if (fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  try {
    // Use macOS sips to convert HEIC to JPEG
    await execFileAsync('sips', [
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', '80', // 80% quality
      heicPath,
      '--out', cachedPath,
    ]);

    return cachedPath;
  } catch (err) {
    console.error('Failed to convert HEIC:', err);
    return heicPath; // Return original on failure
  }
}

/**
 * Check if a file is a HEIC image
 */
export function isHeicImage(filePath: string | null, mimeType: string | null, uti: string | null): boolean {
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.heic' || ext === '.heif') return true;

  if (mimeType?.includes('heic') || mimeType?.includes('heif')) return true;
  if (uti?.includes('heic') || uti?.includes('heif')) return true;

  return false;
}

/**
 * Get the display path for an image, converting HEIC if necessary
 */
export async function getDisplayImagePath(
  originalPath: string | null,
  mimeType: string | null,
  uti: string | null
): Promise<string | null> {
  if (!originalPath) return null;

  if (isHeicImage(originalPath, mimeType, uti)) {
    return convertHeicToJpeg(originalPath);
  }

  return originalPath;
}
