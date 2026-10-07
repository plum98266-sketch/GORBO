import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopyMessages, stripThink, imageUrls, parseArgs, CHANNELS, APP_URL } from '../scripts/minimax-marketing.mjs';

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
