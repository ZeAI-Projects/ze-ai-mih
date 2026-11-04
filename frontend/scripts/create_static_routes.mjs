import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';

// Resolve the same route metadata used by the React app, without a backend.
const source = await readFile(new URL('../src/constants/routes.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { PAGE_METADATA } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const entry = await readFile(join(outputDirectory, 'index.html'), 'utf8');
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Real HTML entry points let static hosts serve direct visits to every page.
for (const [route, metadata] of Object.entries(PAGE_METADATA)) {
  const folder = join(outputDirectory, route.replace(/^\//, ''));
  await mkdir(folder, { recursive: true });
  const html = entry
    .replace(/<title>.*?<\/title>/s, `<title>${escape(metadata.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escape(metadata.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escape(metadata.title)}$2`)
    .replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${escape(metadata.description)}$2`,
    );
  await writeFile(join(folder, 'index.html'), html);
}

await writeFile(join(outputDirectory, '404.html'), entry);
console.log(`Created static entry points for ${Object.keys(PAGE_METADATA).join(', ')}.`);
