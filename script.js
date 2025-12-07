// ===== 전역 상태 =====
let chunks = []; // { index, start, duration, repeat }
let isPlayingAll = false;
let isPaused = false;
let playMode = "none"; // "none" | "single" | "all"
let currentSequence = []; // 전체 재생용 시퀀스
let currentSeqIndex = 0;
let lastObjectUrl = null;

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

// timeupdate 핸들러 관리
let timeUpdateHandler = null;

function setTimeUpdateHandler(handler) {
  if (!audioElement) return;
  if (timeUpdateHandler) {
    audioElement.removeEventListener("timeupdate", timeUpdateHandler);
  }
  timeUpdateHandler = handler;
  if (handler) {
    audioElement.addEventListener("timeupdate", handler);
  }
}

function clearTimeUpdateHandler() {
  setTimeUpdateHandler(null);
}

// ===== 유틸 함수 =====

function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function stopAllPlayback() {
  isPlayingAll = false;
  isPaused = false;
  playMode = "none";
  currentSequence = [];
  currentSeqIndex = 0;

  if (audioElement) {
    audioElement.pause();
    // 원하는 경우 처음으로 돌리려면 아래 주석 해제
    // audioElement.currentTime = 0;
  }
  clearTimeUpdateHandler();

  if (pauseButton) {
    pauseButton.textContent = "일시정지";
  }
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

  // 메타데이터 로딩 후 duration 사용
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

// ===== 단일 구간 재생 =====

function handlePlaySingleChunk(idx) {
  if (!audioElement || !chunks[idx]) {
    alert("먼저 파일을 자른 후에 재생할 수 있습니다.");
    return;
  }

  const chunk = chunks[idx];
  const rate = getPlaybackRate();
  audioElement.playbackRate = rate;

  stopAllPlayback(); // 다른 모드 정리
  playMode = "single";
  let remaining = chunk.repeat || 1;
  isPaused = false;
  pauseButton.textContent = "일시정지";

  const playOne = () => {
    if (remaining <= 0 || playMode !== "single") {
      stopAllPlayback();
      return;
    }

    audioElement.currentTime = chunk.start;
    audioElement
      .play()
      .then(() => {
        setTimeUpdateHandler(() => {
          if (audioElement.currentTime >= chunk.start + chunk.duration) {
            audioElement.pause();
            if (isPaused || playMode !== "single") return;

            remaining--;
            if (remaining > 0) {
              setTimeout(playOne, 50);
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
  };

  playOne();
}

// ===== 전체 재생 =====

function buildSequence() {
  const sequence = [];
  const globalRepeat = parseInt(globalRepeatInput.value, 10);
  const totalSetRepeat =
    Number.isFinite(globalRepeat) && globalRepeat > 0 ? globalRepeat : 1;

  for (let g = 0; g < totalSetRepeat; g++) {
    chunks.forEach((chunk) => {
      const r = chunk.repeat || 1;
      for (let i = 0; i < r; i++) {
        sequence.push({
          start: chunk.start,
          end: chunk.start + chunk.duration,
        });
      }
    });
  }
  return sequence;
}

function handlePlayAll() {
  if (!audioElement || chunks.length === 0) {
    alert("먼저 파일을 자르고 난 후에 전체 재생이 가능합니다.");
    return;
  }

  const rate = getPlaybackRate();
  audioElement.playbackRate = rate;

  stopAllPlayback(); // 초기화
  currentSequence = buildSequence();
  if (currentSequence.length === 0) return;

  playMode = "all";
  isPlayingAll = true;
  isPaused = false;
  pauseButton.textContent = "일시정지";
  currentSeqIndex = 0;

  const playNext = () => {
    if (
      !isPlayingAll ||
      playMode !== "all" ||
      currentSeqIndex >= currentSequence.length
    ) {
      stopAllPlayback();
      return;
    }

    const seg = currentSequence[currentSeqIndex];
    audioElement.currentTime = seg.start;

    audioElement
      .play()
      .then(() => {
        setTimeUpdateHandler(() => {
          if (audioElement.currentTime >= seg.end) {
            audioElement.pause();
            if (isPaused || playMode !== "all") return;

            currentSeqIndex++;
            setTimeout(playNext, 50);
          }
        });
      })
      .catch((e) => {
        console.error(e);
        alert("재생 중 오류가 발생했습니다.");
        stopAllPlayback();
      });
  };

  playNext();
}

// ===== 전체 반복 일괄 조정 =====

function adjustAllRepeats(delta) {
  if (chunks.length === 0) return;
  chunks.forEach((chunk) => {
    const next = (chunk.repeat || 1) + delta;
    chunk.repeat = next > 1 ? next : 1;
  });
  renderChunkList();
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
    audioElement.pause();
    isPaused = true;
    pauseButton.textContent = "다시 재생";
  } else {
    // 다시 재생
    audioElement
      .play()
      .then(() => {
        isPaused = false;
        pauseButton.textContent = "일시정지";
      })
      .catch((e) => {
        console.error(e);
      });
  }
});

// 전체 반복 조절 버튼
repeatAllMinusBtn.addEventListener("click", () => {
  adjustAllRepeats(-1);
});
repeatAllPlusBtn.addEventListener("click", () => {
  adjustAllRepeats(1);
});
repeatAllResetBtn.addEventListener("click", () => {
  if (chunks.length === 0) return;
  chunks.forEach((chunk) => (chunk.repeat = 1));
  renderChunkList();
});
