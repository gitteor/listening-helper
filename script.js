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
        repeat: defaultRepeat, // 기본 반복 횟수 적용
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

// ===== 공통 재생 로직 =====

// 플레이 계획(plan)을 만들어서 시작하는 함수
function startPlayback(plan, mode) {
  if (!audioElement || plan.length === 0) return;

  stopAllPlayback(); // 기존 재생 완전 초기화

  playPlan = plan;
  playIndex = 0;
  playMode = mode;
  isPaused = false;

  audioElement.playbackRate = getPlaybackRate();
  pauseButton.textContent = "일시정지";

  if (mode === "all") {
    playAllButton.disabled = true;
  } else {
    playAllButton.disabled = false;
  }

  playCurrentSegment();
}

// 실제로 plan[playIndex]를 재생하는 함수
function playCurrentSegment() {
  if (playMode === "none" || playIndex >= playPlan.length) {
    stopAllPlayback();
    return;
  }

  const seg = playPlan[playIndex];
  currentSegEnd = seg.end;

  audioElement.currentTime = seg.start;

  audioElement
    .play()
    .then(() => {
      setTimeUpdateHandler(() => {
        if (playMode === "none") return;
        if (isPaused) return;

        // 끝나는 시점 약간 여유(0.01초) 두고 체크
        if (audioElement.currentTime >= currentSegEnd - 0.01) {
          audioElement.pause();
          playIndex++;
          if (playIndex < playPlan.length && playMode !== "none") {
            setTimeout(playCurrentSegment, 50);
          } else {
            stopAllPlayback();
          }
        }
      });
    })
    .catch((e) => {
      console.error(e);
      alert("재생 중 오류가 발생했습니다.");
      stopAllPlayback();
    });
}

// ===== 단일 구간 재생 =====
function handlePlaySingleChunk(idx) {
  if (!audioElement || !chunks[idx]) {
    alert("먼저 파일을 자른 후에 재생할 수 있습니다.");
    return;
  }

  const chunk = chunks[idx];
  const times = chunk.repeat || 1;

  const plan = [];
  for (let i = 0; i < times; i++) {
    plan.push({
      start: chunk.start,
      end: chunk.start + chunk.duration,
    });
  }

  startPlayback(plan, "single");
}

// ===== 전체 재생 =====
function handlePlayAll() {
  if (!audioElement || chunks.length === 0) {
    alert("먼저 파일을 자르고 난 후에 전체 재생이 가능합니다.");
    return;
  }

  const globalRepeat = parseInt(globalRepeatInput.value, 10);
  const totalSetRepeat =
    Number.isFinite(globalRepeat) && globalRepeat > 0 ? globalRepeat : 1;

  const plan = [];

  for (let g = 0; g < totalSetRepeat; g++) {
    chunks.forEach((chunk) => {
      const r = chunk.repeat || 1;
      for (let i = 0; i < r; i++) {
        plan.push({
          start: chunk.start,
          end: chunk.start + chunk.duration,
        });
      }
    });
  }

  startPlayback(plan, "all");
}

// ===== 이벤트 바인딩 =====
cutButton.addEventListener("click", handleCut);
playAllButton.addEventListener("click", handlePlayAll);

stopButton.addEventListener("click", () => {
  stopAllPlayback();
});

// 일시정지 / 다시 재생
pauseButton.addEventListener("click", () => {
  if (!audioElement || playMode === "none") return;

  if (!isPaused) {
    // 일시정지
    isPaused = true;
    audioElement.pause();
    pauseButton.textContent = "다시 재생";
  } else {
    // 다시 재생
    isPaused = false;
    audioElement
      .play()
      .then(() => {
        pauseButton.textContent = "일시정지";
      })
      .catch((e) => {
        console.error(e);
      });
  }
});
