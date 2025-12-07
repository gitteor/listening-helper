// ===== 전역 상태 =====
let chunks = []; // { index, start, duration, repeat }
let playMode = "none"; // "none" | "single" | "all"
let currentSequence = []; // 전체 재생용 시퀀스
let currentSeqIndex = 0;
let singleRepeatRemaining = 0;
let lastObjectUrl = null;
let currentTimeUpdateHandler = null;

// ===== DOM 요소 =====
const fileInput = document.getElementById("audioFile");
const chunkSecondsInput = document.getElementById("chunkSeconds");
const cutButton = document.getElementById("cutButton");
const chunkListEl = document.getElementById("chunkList");
const globalRepeatInput = document.getElementById("globalRepeat");
const playbackRateSelect = document.getElementById("playbackRate");
const playAllButton = document.getElementById("playAllButton");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");

const repeatAllMinusBtn = document.getElementById("repeatAllMinus");
const repeatAllPlusBtn = document.getElementById("repeatAllPlus");
const repeatAllResetBtn = document.getElementById("repeatAllReset");

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
  setTimeUpdateHandler(null);
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
  currentSequence = [];
  currentSeqIndex = 0;
  singleRepeatRemaining = 0;

  if (audioElement) {
    audioElement.pause();
    // audioElement.currentTime = 0; // 필요하면 정지 시 항상 처음으로
  }
  clearTimeUpdateHandler();

  // 전체 재생 버튼 다시 활성화
  playAllButton.disabled = false;

  // 일시정지 버튼 텍스트 초기화
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

  // 이전 파일 URL 해제
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }

  const objectUrl = URL.createObjectURL(file);
  lastObjectUrl = objectUrl;
  audioElement.src = objectUrl;

  audioElement.onloadedmetadata = () => {
    const duration = audioElement.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      alert("오디오 길이를 읽을 수 없습니다.");
      return;
    }

    chunks = [];
    let index = 1;
    for (let start = 0; start < duration; start += sec) {
      const end = Math.min(start + sec, duration);
      const length = end - start;
      chunks.push({
        index,
        start,
        duration: length,
        repeat: 1, // 기본 1회
      });
      index++;
    }

    stopAllPlayback();
    renderChunkList();
  };
}

// ===== 잘린 구간 목록 표시 =====
function renderChunkList() {
  chunkListEl.innerHTML = "";

  if (chunks.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "잘린 구간이 없습니다.";
    chunkListEl.appendChild(p);
    return;
  }

  chunks.forEach((chunk, idx) => {
    const row = document.createElement("div");
    row.className = "chunk-row";
    row.dataset.index = idx.toString();

    const labelSpan = document.createElement("span");
    labelSpan.className = "chunk-label";
    labelSpan.textContent = `구간 ${chunk.index}`;

    const timeSpan = document.createElement("span");
    timeSpan.className = "chunk-time";
    const startText = formatTime(chunk.start);
    const endText = formatTime(chunk.start + chunk.duration);
    timeSpan.textContent = `(${startText} ~ ${endText})`;

    const repeatWrapper = document.createElement("span");
    repeatWrapper.className = "repeat-field";

    const repeatLabel = document.createElement("span");
    repeatLabel.textContent = "반복";

    const repeatInput = document.createElement("input");
    repeatInput.type = "number";
    repeatInput.min = "1";
    repeatInput.value = chunk.repeat.toString();
    repeatInput.addEventListener("change", () => {
      const v = parseInt(repeatInput.val
