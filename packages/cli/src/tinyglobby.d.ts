// Ambient declaration for tinyglobby (0.2.16 ships its types as
// `./dist/index.d.cts` per package.json but that file isn't actually in the
// tarball). Cover only the surface we use; widen if more API surface lands.

declare module 'tinyglobby' {
  export interface GlobOptions {
    cwd?: string;
    ignore?: string | string[];
    onlyFiles?: boolean;
    onlyDirectories?: boolean;
    absolute?: boolean;
    dot?: boolean;
    expandDirectories?: boolean;
    followSymbolicLinks?: boolean;
    caseSensitiveMatch?: boolean;
    deep?: number;
    patterns?: string | string[];
  }

  export function glob(
    patterns: string | string[],
    options?: GlobOptions,
  ): Promise<string[]>;

  export function globSync(
    patterns: string | string[],
    options?: GlobOptions,
  ): string[];
}
