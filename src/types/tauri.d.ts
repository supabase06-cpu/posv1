// src/types/tauri.d.ts
/* Minimal type shims for @tauri-apps/api modules so TypeScript won't error
   when the editor can't resolve the package typings. This is safe and
   non-invasive — it's only used by the compiler/editor to silence missing
   declarations while you keep the real package installed.
*/

declare module '@tauri-apps/api/fs' {
  export function readTextFile(path: string): Promise<string>;
  export function writeFile(options: { path: string; contents: string } | string): Promise<void>;
  export function writeTextFile(path: string, contents: string): Promise<void>;
  export function createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function exists(path: string): Promise<boolean>;
  export function removeFile(path: string): Promise<void>;
  // Add more functions if your code uses them.
}

declare module '@tauri-apps/api/path' {
  // appDir returns Promise<string> in Tauri API
  export function appDir(): Promise<string>;
  export function appConfigDir(): Promise<string>;
  export function appLocalDataDir(): Promise<string>;
  export function resourceDir(): Promise<string>;
  export function resolve(resource: string): Promise<string>;
  // Add other exported members if needed.
}

declare module '@tauri-apps/api' {
  // Generic barrel if you ever import from '@tauri-apps/api'
  export * from '@tauri-apps/api/fs';
  export * from '@tauri-apps/api/path';
}
