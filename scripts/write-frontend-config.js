import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiBase = (process.env.VOLTCHAIN_API_BASE || '').replace(/\/$/, '');
const outputPath = path.join(__dirname, '..', 'frontend', 'config.js');

writeFileSync(
  outputPath,
  `window.VOLTCHAIN_API_BASE = ${JSON.stringify(apiBase)};\n`,
);

console.log(`Wrote ${outputPath} with VOLTCHAIN_API_BASE=${apiBase || '(relative)'}`);

