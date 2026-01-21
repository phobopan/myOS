import { getAuthStatus, askForFullDiskAccess } from 'node-mac-permissions';

export type PermissionStatus = 'authorized' | 'denied' | 'not-determined';

/**
 * Check if Full Disk Access permission is granted.
 * Required for reading ~/Library/Messages/chat.db
 */
export function checkFullDiskAccess(): PermissionStatus {
  const status = getAuthStatus('full-disk-access');
  if (status === 'authorized') return 'authorized';
  if (status === 'not determined') return 'not-determined';
  return 'denied';
}

/**
 * Open System Preferences > Privacy & Security > Full Disk Access
 * Cannot programmatically grant - user must toggle the checkbox
 */
export function requestFullDiskAccess(): void {
  askForFullDiskAccess();
}
