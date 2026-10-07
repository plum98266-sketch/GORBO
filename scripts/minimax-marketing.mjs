// MiniMax API로 홍보 문구와 이미지를 만든다. API 키는 이 스크립트(로컬)에서만 쓰고 앱에는 넣지 않는다.
// 사용법:
//   MINIMAX_API_KEY=... node scripts/minimax-marketing.mjs copy instagram [--n 3]
//   MINIMAX_API_KEY=... node scripts/minimax-marketing.mjs image [--prompt "..."] [--ratio 1:1] [--n 2]
//   --dry-run 을 붙이면 API를 부르지 않고 보낼 요청만 출력한다.
// 환경 변수: MINIMAX_BASE_URL (기본 https://api.minimax.io, 중국 계정은 https://api.minimaxi.com)
//            MINIMAX_MODEL (기본 MiniMax-M2.7)
// 결과는 marketing-out/ 에 저장된다 (git에 올라가지 않음).
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const APP_URL = 'https://plum98266-sketch.github.io/GORBO/';

const PRODUCT = `제품: '심장지킴이' — 반려견·반려묘 심장병(이첨판 폐쇄부전 등) 보호자용 무료 홈케어 웹앱(PWA). 주소 ${APP_URL}
기능:
- 잠든 아이가 숨 쉴 때마다 화면을 톡 누르면 분당 수면 호흡수를 자동 계산
- 기준(보통 30회, 아이별 변경 가능) 초과 시 알림, 2회 연속이면 병원 연락 안내
- 심장약 투약 체크, 기침·식욕 저하 같은 증상 원탭 기록
- 14/30/90일 기록을 그래프로 정리한 진료용 리포트(인쇄·PDF)
- 설치·회원가입 없음, 기록은 휴대폰에만 저장, 홈 화면에 추가하면 앱처럼 사용
현재 베타 테스터를 모집 중이다.`;

const RULES = `규칙:
- 한국어로, 심장병 아이를 돌보는 보호자의 마음에 공감하는 말투로 쓴다.
- 진단·치료·완치·예방 효과를 주장하지 않는다. 기록을 돕는 도구라고만 말한다.
- 마지막에 "기록을 돕는 도구이며 진단을 대신하지 않아요. 숨이 가쁘거나 잇몸이 파랗다면 바로 병원에 연락하세요." 취지의 문장을 넣는다.
- 없는 기능, 수치, 후기, 수의사 추천을 지어내지 않는다.
- 결과 본문만 출력한다. 여러 개를 요청받으면 각 안 사이에 '---' 한 줄을 넣는다.`;

export const CHANNELS = {
  cafe: '네이버 카페 보호자 모임 "후기·정보" 게시판용 경험담 형식 글. 제목 1줄 + 본문 10~15줄, 링크 포함.',
  instagram: '인스타그램 피드 캡션. 4~6줄, 이모지 적당히, 마지막에 해시태그 6~8개(#강아지심장병 #이첨판폐쇄부전 #노견 등). 링크는 "프로필 링크"로 안내.',
  blog: '네이버 블로그 글. 제목 + 소제목 3개 + 본문, 800~1200자, 검색 키워드(강아지 호흡수 측정, 심장병 강아지 기록) 자연스럽게 포함.',
  kakao: '카카오톡 오픈채팅·단톡방에 공유할 짧은 메시지. 3~4줄, 링크 포함.',
  shorts: '30초 세로 영상(릴스·쇼츠) 대본. 장면별로 [화면] 설명과 [자막/내레이션]을 번갈아 6장면 이내.',
};

export const IMAGE_PRESETS = [
  'Warm cozy night scene, a small elderly white Maltese dog sleeping peacefully on a soft blanket, owner\'s hand holding a smartphone nearby with a simple heart-shaped app icon glowing coral red (#e8505b), soft lamplight, gentle and reassuring mood, photorealistic, no text',
  'Clean flat illustration, coral red (#e8505b) heart icon with a subtle heartbeat line, a sleeping puppy silhouette, cream background (#fbf7f4), minimal and friendly, plenty of empty space for a headline, no text',
];

export function buildCopyMessages(channel, n = 1, extra = '') {
  const spec = CHANNELS[channel];
  if (!spec) throw new Error(`알 수 없는 채널: ${channel} (가능: ${Object.keys(CHANNELS).join(', ')})`);
  const ask = `${spec}\n${n > 1 ? `서로 다른 각도로 ${n}개 안을 써 줘.` : '1개 안을 써 줘.'}${extra ? `\n추가 요청: ${extra}` : ''}`;
  return [
    { role: 'system', content: `너는 반려동물 헬스케어 앱의 마케터다.\n${PRODUCT}\n${RULES}` },
    { role: 'user', content: ask },
  ];
}

// MiniMax M2 계열은 추론 과정을 <think>...</think>로 본문에 섞어 보낼 수 있다.
export function stripThink(text) {
  return String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export function checkBaseResp(json) {
  const br = json?.base_resp;
  if (br && br.status_code !== 0) throw new Error(`MiniMax 오류 ${br.status_code}: ${br.status_msg}`);
  return json;
}

export function imageUrls(json) {
  checkBaseResp(json);
  const urls = json?.data?.image_urls;
  if (!Array.isArray(urls) || !urls.length) throw new Error('응답에 이미지 주소가 없습니다');
  return urls;
}

export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function config() {
  return {
    key: process.env.MINIMAX_API_KEY,
    base: (process.env.MINIMAX_BASE_URL || 'https://api.minimax.io').replace(/\/+$/, ''),
    model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
  };
}

async function call(path, body, { key, base }, dryRun) {
  if (dryRun) {
    console.log(`POST ${base}${path}\n${JSON.stringify(body, null, 2)}`);
    return null;
  }
  if (!key) throw new Error('MINIMAX_API_KEY 환경 변수가 필요합니다 (https://platform.minimax.io 에서 발급)');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return checkBaseResp(JSON.parse(text));
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

async function copy(opts, cfg) {
  const channel = opts._[1] || 'instagram';
  const body = { model: cfg.model, messages: buildCopyMessages(channel, Number(opts.n) || 1, opts.extra), temperature: 0.9 };
  const json = await call('/v1/chat/completions', body, cfg, opts.dryRun);
  if (!json) return;
  const text = stripThink(json.choices?.[0]?.message?.content);
  if (!text) throw new Error('응답에 본문이 없습니다');
  mkdirSync('marketing-out', { recursive: true });
  const file = `marketing-out/${channel}-${stamp()}.md`;
  writeFileSync(file, `<!-- ${cfg.model} · ${channel} -->\n\n${text}\n`);
  console.log(`${text}\n\nwrote ${file}`);
}

async function image(opts, cfg) {
  const prompts = opts.prompt ? [opts.prompt] : IMAGE_PRESETS;
  mkdirSync('marketing-out', { recursive: true });
  for (const [i, prompt] of prompts.entries()) {
    const body = { model: 'image-01', prompt, aspect_ratio: opts.ratio || '1:1', n: Number(opts.n) || 1, response_format: 'url', prompt_optimizer: true };
    const json = await call('/v1/image_generation', body, cfg, opts.dryRun);
    if (!json) continue;
    for (const [j, url] of imageUrls(json).entries()) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`이미지 다운로드 실패 HTTP ${res.status}`);
      const file = `marketing-out/image-${stamp()}-${i + 1}-${j + 1}.jpeg`;
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log('wrote', file);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0];
  const cfg = config();
  if (cmd === 'copy') await copy(opts, cfg);
  else if (cmd === 'image') await image(opts, cfg);
  else {
    console.log(`사용법:
  node scripts/minimax-marketing.mjs copy <${Object.keys(CHANNELS).join('|')}> [--n 3] [--extra "추가 요청"] [--dry-run]
  node scripts/minimax-marketing.mjs image [--prompt "..."] [--ratio 1:1|3:4|9:16|16:9] [--n 2] [--dry-run]`);
    process.exitCode = cmd ? 1 : 0;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
