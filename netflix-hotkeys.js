'use strict';

const SEEK_MS = 5000;
const SUBTITLE_KEYS = { e: 'en', k: 'ko' };

// 넷플릭스 내부 플레이어 API — 비공식이라 못 찾으면 null을 리턴하고 기본 동작에 맡긴다.
function getPlayer() {
  try {
    const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
    const ids = videoPlayer.getAllPlayerSessionIds();
    const id = ids.find((s) => s.startsWith('watch-')) || ids[0];
    return id ? videoPlayer.getVideoPlayerBySessionId(id) : null;
  } catch {
    return null;
  }
}

function seek(player, deltaMs) {
  const target = Math.min(Math.max(player.getCurrentTime() + deltaMs, 0), player.getDuration());
  player.seek(target);
}

// Off 트랙은 언어 코드(bcp47)가 없다.
const isOffTrack = (track) => !track || !track.bcp47;

// 같은 언어가 이미 켜져 있으면 끄고, 아니면 그 언어로 켠다. CC보다 일반 자막 우선.
function toggleSubtitles(player, lang) {
  const tracks = player.getTimedTextTrackList() || [];
  const matches = (track) => !isOffTrack(track) && track.bcp47.startsWith(lang);
  if (matches(player.getTimedTextTrack())) {
    const off = tracks.find(isOffTrack);
    if (off) player.setTimedTextTrack(off);
  } else {
    const candidates = tracks.filter(matches);
    const plain = candidates.find((t) => !/\bCC\b|closed caption/i.test(t.displayName || ''));
    const next = plain || candidates[0];
    if (next) player.setTimedTextTrack(next);
  }
}

// document_start에 window capture로 등록 — 넷플릭스 스크립트보다 먼저 잡아서
// 화살표 기본 핸들러(10초 seek)를 대체한다. 나머지 키는 건드리지 않는다.
window.addEventListener(
  'keydown',
  (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && !(key in SUBTITLE_KEYS)) return;
    if (!location.pathname.startsWith('/watch')) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t instanceof Element && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const player = getPlayer();
    if (!player) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (key in SUBTITLE_KEYS) toggleSubtitles(player, SUBTITLE_KEYS[key]);
    else seek(player, key === 'ArrowRight' ? SEEK_MS : -SEEK_MS);
  },
  true
);
