// claude.ai 미리보기(Artifact)용 빌드: CSS를 인라인하고 서비스 워커·매니페스트를 뺀다.
// 사용법: node scripts/build-preview.mjs  →  dist-preview/
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';

const out = 'dist-preview';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/js`, { recursive: true });

const html = readFileSync('app/index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).trim();
const css = readFileSync('app/styles.css', 'utf8');

writeFileSync(`${out}/index.html`, `<title>심장지킴이</title>
<style>
${css}
</style>
<script>window.__SIMJANG_EMBED = true;</script>
${body}
`);
for (const f of ['app.js', 'core.js', 'store.js', 'config.js']) copyFileSync(`app/js/${f}`, `${out}/js/${f}`);
console.log(`built ${out}/`);
