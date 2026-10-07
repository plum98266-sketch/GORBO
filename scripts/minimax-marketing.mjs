// MiniMax API로 홍보 문구와 이미지를 만든다. API 키는 이 스크립트(로컬)에서만 쓰고 앱에는 넣지 않는다.
// 사용법:
//   MINIMAX_API_KEY=... node scripts/minimax-marketing.mjs copy instagram [--n 3]
//   MINIMAX_API_KEY=... node scripts/minimax-marketing.mjs image [--prompt "..."] [--ratio 1:1] [--n 2]
//   MINIMAX_API_KEY=... node scripts/minimax-marketing.mjs video [--prompt "..."] [--image 파일|URL] [--duration 15]
//     (MiniMax H3: 영상과 소리·한국어 내레이션을 한 번에 생성. --prompt 없으면 LLM이 프롬프트를 쓴다)
//   --dry-run 을 붙이면 API를 부르지 않고 보낼 요청만 출력한다.
// 환경 변수: MINIMAX_BASE_URL (기본 https://api.minimax.io, 중국 계정은 https://api.minimaxi.com)
//            MINIMAX_MODEL (기본 MiniMax-M2.7)
// 결과는 marketing-out/ 에 저장된다 (git에 올라가지 않음).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
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

// --- 영상 (MiniMax H3, v2 API): 영상과 소리(효과음·한국어 내레이션)를 한 번에 만든다 ---
export const VIDEO_MODELS = {
  'MiniMax-H3': { durations: [4, 15], resolutions: ['768P', '2K'] },
  'MiniMax-H3-Max': { durations: [5, 15], resolutions: ['480P', '768P'] },
};

// H3는 대사를 지어내지 않으므로 내레이션 문장을 따옴표로 그대로 적고, 소리는 끝의 "Sound:" 절로 지시한다.
// 화면에 말하는 사람이 없으면 내레이션(화면 밖 목소리)으로 처리된다.
export function buildVideoPromptMessages(duration = 15, extra = '') {
  const chars = Math.round(duration * 4.5);
  return [
    { role: 'system', content: `너는 반려동물 헬스케어 앱의 영상 광고 감독이다.\n${PRODUCT}\n${RULES}` },
    {
      role: 'user',
      content: `MiniMax H3 영상 생성 모델에 넣을 프롬프트 1개를 써 줘. 길이 ${duration}초, 세로(9:16) 쇼츠용.
형식:
- 장면·카메라·조명 묘사는 영어로, 시간 순서대로 2~3개 샷.
- 화면에 말하는 사람은 없다. 따뜻한 한국어 여성 내레이션이 화면 밖에서 말한다: A warm female Korean narrator says off-screen: "..."
- 내레이션은 한국어 ${chars}자 이내, 따옴표 안 문장만 그대로 읽힌다. 마지막 문장은 "진단은 꼭 수의사와 함께하세요." 취지로.
- 화면 속 글자·자막·로고는 넣지 말라고 명시한다 (no on-screen text).
- 마지막 줄은 "Sound: ..." 로 배경음·효과음을 지시한다 (예: soft piano, gentle breathing of a sleeping dog, light tap sounds).
프롬프트 본문만 출력해.${extra ? `\n추가 요청: ${extra}` : ''}`,
    },
  ];
}

export function buildVideoBody({ prompt, image, model = 'MiniMax-H3', duration = 15, resolution = '768P', ratio = '9:16' }) {
  const spec = VIDEO_MODELS[model];
  if (!spec) throw new Error(`알 수 없는 영상 모델: ${model} (가능: ${Object.keys(VIDEO_MODELS).join(', ')})`);
  if (!prompt) throw new Error('영상 프롬프트가 비어 있습니다');
  const d = Number(duration);
  if (!Number.isInteger(d) || d < spec.durations[0] || d > spec.durations[1]) throw new Error(`${model} 길이는 ${spec.durations.join('~')}초입니다`);
  if (!spec.resolutions.includes(resolution)) throw new Error(`${model} 해상도는 ${spec.resolutions.join(', ')} 중 하나입니다`);
  const [w, h] = String(ratio).split(':').map(Number);
  if (!(w / h >= 0.4 && w / h <= 2.5)) throw new Error(`화면 비율(가로/세로)은 0.4~2.5 사이여야 합니다: ${ratio}`);
  const content = [{ type: 'text', text: prompt }];
  if (image) content.push({ type: 'image_url', image_url: { url: image }, role: 'first_frame' });
  return { model, content, resolution, duration: d, ratio };
}

// 조회 응답 { task: { status, content: { url } } } 를 읽는다.
export function videoTask(json) {
  checkBaseResp(json);
  const t = json?.task ?? json;
  const status = String(t?.status ?? '').toLowerCase();
  if (['failed', 'fail', 'cancelled', 'canceled', 'expired'].includes(status)) {
    throw new Error(`영상 생성 실패: ${JSON.stringify(t.error ?? t).slice(0, 300)}`);
  }
  return { status, url: status === 'succeeded' || status === 'success' ? t?.content?.url : undefined };
}

// 비용 추정 (2026-10 기준 공개 가격 MiniMax-H3: 768P $0.08/초, 2K $0.13/초. 실제 요금은 콘솔에서 확인)
export function estimateVideoUsd(duration, resolution) {
  return +(duration * (resolution === '2K' ? 0.13 : 0.08)).toFixed(2);
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

async function call(path, body, { key, base }, dryRun, method = 'POST') {
  if (dryRun) {
    console.log(`${method} ${base}${path}\n${JSON.stringify(body, null, 2)}`);
    return null;
  }
  if (!key) throw new Error('MINIMAX_API_KEY 환경 변수가 필요합니다 (https://platform.minimax.io 에서 발급)');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
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

async function chat(messages, cfg, dryRun) {
  const json = await call('/v1/chat/completions', { model: cfg.model, messages, temperature: 0.9 }, cfg, dryRun);
  if (!json) return null;
  const text = stripThink(json.choices?.[0]?.message?.content);
  if (!text) throw new Error('응답에 본문이 없습니다');
  return text;
}

// 로컬 파일은 data URI로 보낸다 (공개 URL이면 그대로).
function imageRef(image) {
  if (!image || /^(https?:|data:)/.test(image)) return image;
  const ext = extname(image).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext || 'jpeg'};base64,${readFileSync(image).toString('base64')}`;
}

async function video(opts, cfg) {
  const duration = Number(opts.duration) || 15;
  const resolution = opts.resolution || '768P';
  let prompt = opts.prompt;
  if (!prompt) {
    prompt = (await chat(buildVideoPromptMessages(duration, opts.extra), cfg, opts.dryRun)) ?? '(LLM이 쓸 프롬프트)';
  }
  const body = buildVideoBody({ prompt, image: imageRef(opts.image), model: opts.model, duration, resolution, ratio: opts.ratio });
  console.log(`--- 영상 프롬프트 ---\n${prompt}\n--- 예상 비용 약 $${estimateVideoUsd(duration, resolution)} ---`);
  const created = await call('/v2/video_generation', body, cfg, opts.dryRun);
  if (!created) return;
  const id = created.task_id ?? created.id ?? created.task?.id;
  if (!id) throw new Error(`task_id가 없습니다: ${JSON.stringify(created).slice(0, 300)}`);
  console.log(`작업 ${id} 생성됨, 완성될 때까지 10초마다 확인합니다 (보통 몇 분)`);
  const deadline = Date.now() + 30 * 60_000;
  let url;
  while (!url) {
    if (Date.now() > deadline) throw new Error(`30분 안에 끝나지 않았습니다. 나중에 작업 ${id}를 콘솔에서 확인하세요`);
    await new Promise((r) => setTimeout(r, 10_000));
    const t = videoTask(await call(`/v2/query/video_generation/${id}`, null, cfg, false, 'GET'));
    process.stdout.write(`  ${t.status}\n`);
    url = t.url;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`영상 다운로드 실패 HTTP ${res.status}`);
  mkdirSync('marketing-out', { recursive: true });
  const file = `marketing-out/video-${stamp()}.mp4`;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  writeFileSync(file.replace('.mp4', '.txt'), `${prompt}\n`);
  console.log('wrote', file);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0];
  const cfg = config();
  if (cmd === 'copy') await copy(opts, cfg);
  else if (cmd === 'image') await image(opts, cfg);
  else if (cmd === 'video') await video(opts, cfg);
  else {
    console.log(`사용법:
  node scripts/minimax-marketing.mjs copy <${Object.keys(CHANNELS).join('|')}> [--n 3] [--extra "추가 요청"] [--dry-run]
  node scripts/minimax-marketing.mjs image [--prompt "..."] [--ratio 1:1|3:4|9:16|16:9] [--n 2] [--dry-run]
  node scripts/minimax-marketing.mjs video [--prompt "..."] [--extra "추가 요청"] [--image 파일|URL]
        [--duration 4~15] [--resolution 768P|2K] [--ratio 9:16] [--model MiniMax-H3|MiniMax-H3-Max] [--dry-run]`);
    process.exitCode = cmd ? 1 : 0;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
