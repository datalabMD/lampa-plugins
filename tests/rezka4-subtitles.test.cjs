const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'rezka4.js'), 'utf8');

function between(name, next) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${next}(`, start);
  assert.ok(start >= 0 && end > start, `extract ${name}`);
  return source.slice(start, end);
}

const parserSource = [
  between('strip', 'attr'),
  between('subtitleUrl', 'subtitleList'),
  between('subtitleList', 'copySubtitles'),
  between('copySubtitles', 'requestEpisodes'),
].join('\n');

const { subtitleList, copySubtitles } = new Function(
  `${parserSource};return {subtitleList,copySubtitles};`,
)();

const liveLike = subtitleList(
  '[Русский]https://static.example/ru.vtt,[Українська]https://static.example/ua.vtt,[English]https://static.example/en.vtt',
  { 'откл.': '', Русский: 'ru', Українська: 'ua', English: 'en' },
  'en',
);
assert.deepEqual(
  liveLike.map((item) => [item.index, item.label]),
  [[0, 'English'], [1, 'Русский'], [2, 'Українська']],
);
assert.ok(liveLike.every((item) => Object.keys(item).sort().join(',') === 'index,label,url'));

const alternatives = subtitleList(
  '[RU]http://bad.example/a.vtt or https://cdn.example/a.vtt or https://cdn.example/b.vtt',
  { RU: 'ru' },
  'ru',
);
assert.equal(alternatives.length, 1);
assert.equal(alternatives[0].url, 'https://cdn.example/b.vtt');

const commaUrl = subtitleList(
  '[RU]https://cdn.example/a,b.vtt,[EN]https://cdn.example/en.vtt',
  {},
  '',
);
assert.equal(commaUrl.length, 2);
assert.equal(commaUrl[0].url, 'https://cdn.example/a,b.vtt');

const filtered = subtitleList(
  '[JS]javascript:alert(1),[HTTP]http://cdn.example/a.vtt,[Auth]https://u:p@cdn.example/a.vtt,[Space]https://cdn.example/a b.vtt,[Good]https://cdn.example/good.vtt,[Dup]https://cdn.example/good.vtt',
  {},
  '',
);
assert.deepEqual(filtered.map((item) => item.label), ['Good']);
assert.deepEqual(subtitleList(false, false, false), []);

const many = Array.from(
  { length: 25 },
  (_, index) => `[T${index}]https://cdn.example/${index}.vtt`,
).join(',');
assert.equal(subtitleList(many, {}, '').length, 20);
assert.deepEqual(subtitleList('['.repeat(65536), {}, ''), []);

const copied = copySubtitles([
  { label: 'Bad', url: 'http://cdn.example/a.vtt' },
  { label: 'One', url: 'https://cdn.example/one.vtt' },
  { label: 'Again', url: 'https://cdn.example/one.vtt' },
  { label: 'Two', url: 'https://cdn.example/two.vtt' },
]);
assert.deepEqual(
  copied.map((item) => [item.index, item.label]),
  [[0, 'One'], [1, 'Two']],
);

const requestStream = new Function(
  'xhr',
  'plist',
  'dec',
  'subtitleList',
  'DOMAIN',
  `${between('requestStream', 'addStyles')};return requestStream;`,
)(
  (_method, _url, _body, success) => success(JSON.stringify({
    success: true,
    url: 'encoded-video-list',
    subtitle: '[Русский]https://cdn.example/ru.vtt,[English]https://cdn.example/en.vtt',
    subtitle_lns: { Русский: 'ru', English: 'en' },
    subtitle_def: 'ru',
  })),
  () => [{ label: '1080p', file: 'https://video.example/one.m3u8', premium: false }],
  (value) => value,
  subtitleList,
  'https://source.example',
);
let streamedQualities;
requestStream(
  { is_series: true, film_id: '45', favs: '' },
  { id: '238' },
  { id: '1' },
  { episode_id: '1' },
  (qualities) => { streamedQualities = qualities; },
  (message) => assert.fail(message),
);
assert.equal(streamedQualities.length, 1);
assert.deepEqual(
  streamedQualities[0].subtitles.map((item) => item.label),
  ['Русский', 'English'],
);

const voiceCache = { 238: {} };
const playerData = new Function(
  'copySubtitles',
  'title',
  'r4num',
  'rememberPlayback',
  'voiceCache',
  'rememberCatalog',
  'historyApi',
  'movie',
  'nextEpisode',
  'findSeason',
  'findEpisode',
  'requestStream',
  'info',
  'sortedQualities',
  'automaticQuality',
  'preference',
  `${between('playerData', 'play')};return playerData;`,
)(
  copySubtitles,
  'Title',
  (value) => Number.parseInt(String(value || '').match(/\d+/)?.[0] || '0', 10),
  () => {},
  voiceCache,
  () => {},
  () => null,
  {},
  (_data, _season, episode) => Number(episode) === 1
    ? { season: 1, episode: 2, item: { episode_id: '2', name: 'Episode 2' } }
    : null,
  () => ({ id: '1', name: 'Season 1' }),
  () => ({ episode_id: '2', name: 'Episode 2' }),
  (_info, _voice, _season, _episode, success) => success([{
    label: '1080p',
    file: 'https://video.example/two.m3u8',
    subtitles: [{ index: 0, label: 'English', url: 'https://cdn.example/en-2.vtt' }],
  }]),
  {},
  (qualities) => qualities.slice(),
  (qualities) => qualities[0],
  {},
);

const firstPlayerItem = playerData(
  { id: '238', name: 'Original' },
  { id: '1', name: 'Season 1' },
  { episode_id: '1', name: 'Episode 1' },
  streamedQualities[0],
);
assert.deepEqual(firstPlayerItem.subtitles.map((item) => item.label), ['Русский', 'English']);
assert.notEqual(firstPlayerItem.subtitles, streamedQualities[0].subtitles);
assert.ok(firstPlayerItem.rezka4_next);

const noSubtitlePlayerItem = playerData(
  { id: '238', name: 'Original' },
  null,
  null,
  { label: '1080p', file: 'https://video.example/no-subs.m3u8', subtitles: [] },
);
assert.equal(Object.prototype.hasOwnProperty.call(noSubtitlePlayerItem, 'subtitles'), false);

let nextPlayerItem;
firstPlayerItem.rezka4_next.load(
  (item) => { nextPlayerItem = item; },
  (message) => assert.fail(message),
);
assert.deepEqual(nextPlayerItem.subtitles, [
  { index: 0, label: 'English', url: 'https://cdn.example/en-2.vtt' },
]);

console.log('rezka4 subtitles: 12 cases passed');
