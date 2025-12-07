// ===== 전역 상태 =====
let chunks = [];              // { index, start, duration, repeat }
let playMode = "none";        // "none" | "single" | "all"
let playPlan = [];            // [{ start, end }]
let playIndex = 0;            // 현재 재생 중인 playPlan 인덱스
let isPaused = false;
let lastObjectUrl = null;
let currentTimeUpdateHandler = null;
let currentSegEnd = 0;        // 현재 구간의 끝나는 시각(초)

// ===== DOM 요소 =====
const fileInput = document.getElementById("audioFile");
const chunkSecondsInput = document.getElementById("chunkSeconds");
const defaultRepeatInput = document.getElementById("defaultRepeat");
const cutButton = document.getElementById("cutButton");
const chunkListEl = document.getElementById("chunkList");

const globalRepeatInput = document.getElementById("globalRepeat");
const playbackRateSelect = document.getElementById("playbackRate");
const playAllButton = document.getElementById("playAllButton");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");

const audioElement = document.getElementById("audioPlayer");

// ===== timeupdate 핸들러 관리 =====
function setTimeUpdateHandler(handler) {
  if (!audioElement) return;
  if (currentTimeUpdateHandler) {
    audioElement.removeEventListener("timeupdate", currentTimeUpdateHandler);
  }
  currentTimeUpdateHandler = handler;
  if (handler) {
    audioElement.addEventListener("timeupdate", handler);
  }
}

function clearTimeUpdateHandler() {
  if (!audioElement || !currentTimeUpdateHandler) return;
  audioElement.removeEventListener("timeupdate", currentTimeUpdateHandler);
  currentTimeUpdateHandler = null;
}

// ===== 유틸 =====
function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function stopAllPlayback() {
  playMode = "none";
  playPlan = [];
  playIndex = 0;
  isPaused = false;

  if (audioElement) {
    audioElement.pause();
    // audioElement.currentTime = 0; // 필요하면 항상 처음으로 되돌리려면 주석 해제
  }
  clearTimeUpdateHandler();

  playAllButton.disabled = false;
  pauseButton.textContent = "일시정지";
}

// ===== 파일 자르기 =====
async function handleCut() {
  const file = fileInput.files[0];
  if (!file) {
    alert("먼저 음성 파일을 선택해주세요.");
    return;
  }

  const sec = parseFloat(chunkSecondsInput.value);
  if (!Number.isFinite(sec) || sec <= 0) {
    alert("자를 길이는 1초 이상의 숫자로 입력해주세요.");
    return;
  }

  let defaultRepeat = parseInt(defaultRepeatInput.value, 10);
  if (!Number.isFinite(defaultRepeat) || defaultRepeat < 1) {
    defaultRepeat = 1;
    defaultRepeatInput.value = "1";
  }

  // 이전 파일 URL 해제
