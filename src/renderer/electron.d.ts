export type PermissionStatus = 'authorized' | 'denied' | 'not-determined';

interface ElectronAPI {
  titlebarDoubleClick: () => void;
  platform: string;
  checkFullDiskAccess: () => Promise<PermissionStatus>;
  requestFullDiskAccess: () => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
