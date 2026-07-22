/// <reference types="vite/client" />

declare const process: {
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
  argv: string[];
};
