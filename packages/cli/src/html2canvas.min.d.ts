// Declaration for the html2canvas minified bundle imported as a plain string.
// The actual content is embedded at build time by the html2canvas-text esbuild
// plugin in build.mjs — this file is only here to satisfy the TypeScript compiler.
declare module 'html2canvas/dist/html2canvas.min.js' {
  const source: string;
  export default source;
}
