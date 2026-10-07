import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCopyMessages, stripThink, imageUrls, parseArgs, CHANNELS, APP_URL,
  buildVideoBody, videoTask, buildVideoPromptMessages, estimateVideoUsd,
} from '../scripts/minimax-marketing.mjs';

test('buildCopyMessages includes product facts, safety rule and channel spec', () => {
  const [sys, user] = buildCopyMessages('cafe', 3, '말티즈 보호자 대상');
  assert.equal(sys.role, 'system');
  assert.ok(sys.content.includes(APP_URL));
  assert.ok(sys.content.includes('진단을 대신하지 않아요'));
  assert.ok(user.content.includes(CHANNELS.cafe));
  assert.ok(user.content.includes('3개 안'));
  assert.ok(user.content.includes('말티즈 보호자 대상'));
  assert.throws(() => buildCopyMessages('tiktok'), /알 수 없는 채널/);
});

test('stripThink removes reasoning blocks', () => {
  assert.equal(stripThink('<think>고민\n중</think>\n\n본문'), '본문');
  assert.equal(stripThink(undefined), '');
});

test('imageUrls reads urls and surfaces API errors', () => {
  assert.deepEqual(imageUrls({ data: { image_urls: ['a', 'b'] }, base_resp: { status_code: 0 } }), ['a', 'b']);
  assert.throws(() => imageUrls({ base_resp: { status_code: 1004, status_msg: 'auth failed' } }), /1004: auth failed/);
  assert.throws(() => imageUrls({ data: {} }), /이미지 주소가 없습니다/);
});

test('parseArgs', () => {
  assert.deepEqual(parseArgs(['copy', 'blog', '--n', '2', '--dry-run']), { _: ['copy', 'blog'], n: '2', dryRun: true });
});

test('buildVideoBody builds an H3 v2 request with optional first frame', () => {
  const body = buildVideoBody({ prompt: 'p', image: 'https://x/a.png' });
  assert.deepEqual(body, {
    model: 'MiniMax-H3',
    content: [{ type: 'text', text: 'p' }, { type: 'image_url', image_url: { url: 'https://x/a.png' }, role: 'first_frame' }],
    resolution: '768P', duration: 15, ratio: '9:16',
  });
  assert.equal(buildVideoBody({ prompt: 'p', duration: 4 }).content.length, 1);
  assert.throws(() => buildVideoBody({ prompt: 'p', duration: 20 }), /4~15초/);
  assert.throws(() => buildVideoBody({ prompt: 'p', model: 'MiniMax-H3-Max', duration: 4 }), /5~15초/);
  assert.throws(() => buildVideoBody({ prompt: 'p', resolution: '1080P' }), /해상도/);
  assert.throws(() => buildVideoBody({ prompt: 'p', ratio: '1:4' }), /0.4~2.5/);
  assert.throws(() => buildVideoBody({ prompt: '' }), /비어/);
});

test('videoTask reads status and url', () => {
  assert.deepEqual(videoTask({ task: { status: 'running' } }), { status: 'running', url: undefined });
  assert.deepEqual(videoTask({ task: { status: 'succeeded', content: { url: 'u' } } }), { status: 'succeeded', url: 'u' });
  assert.throws(() => videoTask({ task: { status: 'failed', error: { message: 'nsfw' } } }), /nsfw/);
});

test('buildVideoPromptMessages asks for Korean narration and Sound clause', () => {
  const [, user] = buildVideoPromptMessages(10);
  assert.ok(user.content.includes('45자'));
  assert.ok(user.content.includes('Sound:'));
  assert.equal(estimateVideoUsd(15, '768P'), 1.2);
  assert.equal(estimateVideoUsd(15, '2K'), 1.95);
});
