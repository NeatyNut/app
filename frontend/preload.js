export interface IElectronAPI {
  send: (channel: string, data: any) => void;
  // 필요한 경우 receive 등 추가
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}