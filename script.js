// 전역 상태
let audioCtx = null;
let audioBuffer = null;
let chunks = []; // { index, start, duration, repeat }
let currentSource = null;
let isPlayingAll = false;
let playQueue = [];

// DOM 요소 캐시
const fileInput = document.getElementById("audioFile");
const chunkSecondsInput = document.getElementById("chunkSeconds");
const cutButton = document.getElementById("cutButton");
const chunkListEl = document.getElementById("chunkList");
const globalRepeatInput = document.getElementById("globalRepeat");
const playbackRateSelect = document.getElementById("playbackRate");
const playAllButton = document.getElementById("playAllButton");
const stopButton = document.getElementById("stopButton");

// ============ 유틸 함수들 ============

function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function stopAllPlayback() {
  isPlayingAll = false;
  playQueue = [];
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {
      // 이미 종료된 경우 에러 무시
    }
    currentSource = null;
  }
}

// ============ 파일 자르기 ============

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

  // 오디오 컨텍스트 생성
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error(e);
    alert("오디오 파일을 읽는 중 오류가 발생했습니다.");
    return;
  }

  const duration = audioBuffer.duration;
  chunks = [];

  let index = 1;
  for (let start = 0; start < duration; start += sec) {
    const end = Math.min(start + sec, duration);
    const length = end - start;
    chunks.push({
      index,
      start,
      duration: length,
      repeat: 1, // 기본 반복 1회
    });
    index++;
  }

  renderChunkList();
}

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
      const v = parseInt(repeatInput.value, 10);
      chunk.repeat = Number.isFinite(v) && v > 0 ? v : 1;
      repeatInput.value = chunk.repeat.toString();
    });

    const repeatSuffix = document.createElement("span");
    repeatSuffix.textContent = "회";

    repeatWrapper.appendChild(repeatLabel);
    repeatWrapper.appendChild(repeatInput);
    repeatWrapper.appendChild(repeatSuffix);

    const playButton = document.createElement("button");
    playButton.className = "secondary";
    playButton.textContent = "이 구간 재생";
    playButton.addEventListener("click", () => {
      handlePlaySingleChunk(idx);
    });

    row.appendChild(labelSpan);
    row.appendChild(timeSpan);
    row.appendChild(repeatWrapper);
    row.appendChild(playButton);

    chunkListEl.appendChild(row);
  });
}

// ============ 단일 구간 재생 ============

async function handlePlaySingleChunk(idx) {
  if (!audioBuffer || !audioCtx) {
    alert("먼저 파일을 자른 후에 재생할 수 있습니다.");
    return;
  }
  if (!chunks[idx]) return;

  stopAllPlayback(); // 다른 재생 중이면 중단
  const chunk = chunks[idx];

  // 브라우저 정책 때문에 필요할 수 있음
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const rate = getPlaybackRate();
  let remaining = chunk.repeat;

  const playOnce = () => {
    if (remaining <= 0) {
      currentSource = null;
      return;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.playbackRate.value = rate;

    source.onended = () => {
      remaining--;
      if (remaining > 0) {
        playOnce();
      } else {
        currentSource = null;
      }
    };

    currentSource = source;
    source.start(0, chunk.start, chunk.duration);
  };

  playOnce();
}

// ============ 전체 재생 ============

function buildPlayQueue() {
  playQueue = [];
  const globalRepeat = parseInt(globalRepeatInput.value, 10);
  const totalSetRepeat =
    Number.isFinite(globalRepeat) && globalRepeat > 0 ? globalRepeat : 1;

  for (let g = 0; g < totalSetRepeat; g++) {
    chunks.forEach((chunk) => {
      const r = chunk.repeat || 1;
      for (let i = 0; i < r; i++) {
        playQueue.push({
          start: chunk.start,
          duration: chunk.duration,
        });
      }
    });
  }
}

async function handlePlayAll() {
  if (!audioBuffer || !audioCtx || chunks.length === 0) {
    alert("먼저 파일을 자르고 난 후에 전체 재생이 가능합니다.");
    return;
  }

  stopAllPlayback();
  buildPlayQueue();
  if (playQueue.length === 0) return;

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  isPlayingAll = true;
  playNextInQueue();
}

function playNextInQueue() {
  if (!isPlayingAll) return;
  if (playQueue.length === 0) {
    isPlayingAll = false;
    currentSource = null;
    return;
  }

  const seg = playQueue.shift();
  const rate = getPlaybackRate();

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.playbackRate.value = rate;

  source.onended = () => {
    currentSource = null;
    if (!isPlayingAll) return;
    playNextInQueue();
  };

  currentSource = source;
  source.start(0, seg.start, seg.duration);
}

// ============ 이벤트 바인딩 ============

cutButton.addEventListener("click", handleCut);
playAllButton.addEventListener("click", handlePlayAll);
stopButton.addEventListener("click", () => {
  stopAllPlayback();
});
