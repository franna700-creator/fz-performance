import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The neutral shell is source, not a transformation of a historical release.
// All writes are confined to dist; runtime truth arrives through canonical APIs.
export function buildShell(root = process.cwd()) {
  const shell = path.join(root, 'src', 'shell');
  const dist = path.join(root, 'dist');
  const shellFiles = ['index.html', 'manifest.webmanifest', 'icon.svg', 'release-ui-contract.json'];
  const contract = JSON.parse(fs.readFileSync(path.join(shell, 'release-ui-contract.json'), 'utf8'));
  const assets = contract.requiredAssets;
  if (!Array.isArray(assets) || !assets.length || new Set(assets).size !== assets.length) {
    throw new Error('Shell contract must declare a unique, nonempty asset inventory');
  }
  const inputs = shellFiles.map(name => [path.join(shell, name), name]);
  for (const name of assets) {
    if (!/^[a-z0-9-]+\.(?:js|css|webp)$/.test(name)) throw new Error(`Invalid shell asset: ${name}`);
    inputs.push([path.join(root, 'src', name), `assets/${name}`]);
  }
  // Validate the complete input set before replacing the previous output.
  for (const [source] of inputs) {
    if (!fs.statSync(source).isFile()) throw new Error(`Shell source is not a file: ${source}`);
    if (source.endsWith('.webp')) {
      const bytes = fs.readFileSync(source);
      if (bytes.length < 1024 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
        throw new Error(`Invalid WebP shell source: ${source}`);
      }
    }
  }
  const html = fs.readFileSync(path.join(shell, 'index.html'), 'utf8');
  for (const [, name] of html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)) {
    if (!assets.includes(name)) throw new Error(`Shell references an undeclared asset: ${name}`);
  }
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  for (const [source, relative] of inputs) fs.copyFileSync(source, path.join(dist, relative));
  return { shellFiles: shellFiles.length, assets: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = buildShell();
  console.log(`PASS canonical shell build: ${result.shellFiles} shell files, ${result.assets} unchanged source assets`);
}
