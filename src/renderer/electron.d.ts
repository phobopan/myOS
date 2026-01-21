interface ElectronAPI {
  titlebarDoubleClick: () => void;
  platform: string;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
