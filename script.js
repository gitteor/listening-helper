// ===== 전역 상태 =====
let chunks = []; // { index, start, duration, repeat }
let isPlayingAll = false;
let currentTimeUpdateHandler = null;

// ===== DOM 요소 =====
const fileInput          = document.getElementById("audioFile");
const chunkSecondsInput  = document.getElementById("chunkSeconds");
const defaultRepeatInput = document.getElementById("defaultRepeat");
const cutButton          = document.getElementById("cutButton");
const chunkListEl        = document.getElementById("chunkList");

const globalRepeatInput  = document.getElementById("globalRepeat");
const playbackRateSelect = document.getElementById("playbackRate");
const playAllButton      = document.getElementById("playAllButton");
const pauseButton        = document.getElementById("pauseButton");
const stopButton         = document.getElementById("stopButton");

const audioElement       = document.getElementById("audioPlayer");

// ===== 유틸 =====
function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

// 현재 재생 구간 하이라이트 초기화
function clearActiveChunkHighlight() {
  const activeRows = chunkListEl.querySelectorAll(".chunk-row.active");
  activeRows.forEach((row) => row.classList.remove("active"));
}

// 지정 인덱스 구간 하이라이트
function setActiveChunkHighlight(chunkIndex) {
  clearActiveChunkHighlight();
  const row = chunkListEl.querySelector(
    `.chunk-row[data-chunk-index="${chunkIndex}"]`
  );
  if (row) {
    row.classList.add("active");
  }
}

// ===== 1. 자르기 버튼 동작 =====
cutButton.addEventListener("click", () => {
  console.log("[DEBUG] 자르기 버튼 클릭");

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

  const objectUrl = URL.createObjectURL(file);
  audioElement.src = objectUrl;

  audioElement.onloadedmetadata = () => {
    const duration = audioElement.duration;
    console.log("[DEBUG] 오디오 길이(초):", duration);

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
        index: index,
        start: start,
        duration: length,
        repeat: defaultRepeat
      });

      index++;
    }

    clearActiveChunkHighlight();
    isPlayingAll = false;
    renderChunkList();
  };
});

// ===== 2. 잘린 구간 목록 렌더링 =====
function renderChunkList() {
  chunkListEl.innerHTML = "";

  if (chunks.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "파일을 선택하고 자르기를 눌러주세요.";
    chunkListEl.appendChild(p);
    return;
  }

  chunks.forEach((chunk, idx) => {
    const row = document.createElement("div");
    row.className = "chunk-row";
    // 하이라이트를 위해 인덱스를 data-속성으로 저장
    row.dataset.chunkIndex = String(idx);

    const labelSpan = document.createElement("span");
    labelSpan.className = "chunk-label";
    // 이 텍스트는 마음대로 바꾸셔도 됩니다.
    labelSpan.textContent = `구간 ${chunk.index}`;

    const timeSpan = document.createElement("span");
    timeSpan.className = "chunk-time";
    const startText = formatTime(chunk.start);
    const endText   = formatTime(chunk.start + chunk.duration);
    timeSpan.textContent = `(${startText} ~ ${endText})`;

    const repeatWrapper = document.createElement("span");
    repeatWrapper.className = "repeat-field";

    const repeatLabel = document.createElement("span");
    repeatLabel.textContent = "반복";

    const repeatInput = document.createElement("input");
    repeatInput.type = "number";
    repeatInput.min = "1";
    repeatInput.value = String(chunk.repeat);
    repeatInput.addEventListener("change", () => {
      const v = parseInt(repeatInput.value, 10);
      chunk.repeat = Number.isFinite(v) && v > 0 ? v : 1;
      repeatInput.value = String(chunk.repeat);
    });

    const repeatSuffix = document.createElement("span");
    repeatSuffix.textContent = "회";

    repeatWrapper.appendChild(repeatLabel);
    repeatWrapper.appendChild(repeatInput);
    repeatWrapper.appendChild(repeatSuffix);

    const playButton = document.createElement("button");
    playButton.className = "secondary";
    // 여기 텍스트도 자유롭게 바꾸셔도 됩니다.
    playButton.textContent = "▶";
    playButton.addEventListener("click", () => {
      clearActiveChunkHighlight();
      setActiveChunkHighlight(idx); // 개별 재생 시에도 표시 (원치 않으면 이 줄 삭제)
      playSection(chunk.start, chunk.start + chunk.duration, chunk.repeat, () => {
        clearActiveChunkHighlight();
      });
    });

    row.appendChild(labelSpan);
    row.appendChild(timeSpan);
    row.appendChild(repeatWrapper);
    row.appendChild(playButton);

    chunkListEl.appendChild(row);
  });
}

// ===== 3. 단일 구간 재생 (반복 + 콜백 지원) =====
function playSection(start, end, repeatCount, onComplete) {
  let count = 0;

  function playOnce() {
    count += 1;
    const rate = getPlaybackRate();
    audioElement.currentTime = start;
    audioElement.playbackRate = rate;

    audioElement.play().catch((e) => {
      console.error("[DEBUG] 재생 에러:", e);
    });

    // 이전 handler 제거
    if (currentTimeUpdateHandler) {
      audioElement.removeEventListener("timeupdate", currentTimeUpdateHandler);
      currentTimeUpdateHandler = null;
    }

    currentTimeUpdateHandler = () => {
      if (audioElement.currentTime >= end) {
        audioElement.pause();
        if (currentTimeUpdateHandler) {
          audioElement.removeEventListener("timeupdate", currentTimeUpdateHandler);
          currentTimeUpdateHandler = null;
        }

        if (count < repeatCount) {
          playOnce();
        } else {
          if (typeof onComplete === "function") {
            onComplete();
          }
        }
      }
    };

    audioElement.addEventListener("timeupdate", currentTimeUpdateHandler);
  }

  playOnce();
}

// ===== 4. 전체 재생 =====
playAllButton.addEventListener("click", () => {
  if (isPlayingAll) return;
  if (chunks.length === 0) {
    alert("먼저 자르기를 실행해 주세요.");
    return;
  }

  let globalRepeat = parseInt(globalRepeatInput.value, 10);
  if (!Number.isFinite(globalRepeat) || globalRepeat < 1) {
    globalRepeat = 1;
    globalRepeatInput.value = "1";
  }

  const plan = [];

  // plan = [ {start, end, repeat, chunkIndex}, ... ]
  for (let g = 0; g < globalRepeat; g++) {
    chunks.forEach((chunk, chunkIndex) => {
      const r = chunk.repeat || 1;
      plan.push({
        start: chunk.start,
        end: chunk.start + chunk.duration,
        repeat: r,
        chunkIndex: chunkIndex
      });
    });
  }

  if (plan.length === 0) return;

  isPlayingAll = true;
  playAllButton.disabled = true;

  let idx = 0;

  function playNext() {
    if (!isPlayingAll) {
      clearActiveChunkHighlight();
      playAllButton.disabled = false;
      return;
    }

    if (idx >= plan.length) {
      isPlayingAll = false;
      clearActiveChunkHighlight();
      playAllButton.disabled = false;
      return;
    }

    const seg = plan[idx];
    idx += 1;

    setActiveChunkHighlight(seg.chunkIndex);

    playSection(seg.start, seg.end, seg.repeat, () => {
      playNext();
    });
  }

  playNext();
});

// ===== 5. 일시정지 / 다시 재생 =====
pauseButton.addEventListener("click", () => {
  if (audioElement.paused) {
    audioElement.play().catch((e) => console.error(e));
    pauseButton.textContent = "일시정지";
  } else {
    audioElement.pause();
    pauseButton.textContent = "다시 재생";
  }
});

// ===== 6. 정지 =====
stopButton.addEventListener("click", () => {
  isPlayingAll = false;
  audioElement.pause();
  audioElement.currentTime = 0;

  if (currentTimeUpdateHandler) {
    audioElement.removeEventListener("timeupdate", currentTimeUpdateHandler);
    currentTimeUpdateHandler = null;
  }

  clearActiveChunkHighlight();
  playAllButton.disabled = false;
  pauseButton.textContent = "일시정지";
});
