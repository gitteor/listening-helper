// ===== 전역 상태 =====
let chunks = []; // { index, start, duration, repeat }

// ===== DOM 요소 (네 HTML id 그대로) =====
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

// 디버깅용: 필수 DOM이 제대로 잡혔는지 확인
console.log("DOM refs:", {
  fileInput,
  chunkSecondsInput,
  defaultRepeatInput,
  cutButton,
  chunkListEl,
  globalRepeatInput,
  playbackRateSelect,
  playAllButton,
  pauseButton,
  stopButton,
  audioElement
});

// ===== 유틸 =====
function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

// ===== 자르기 로직 (핵심) =====
cutButton.addEventListener("click", () => {
  console.log("자르기 버튼 클릭됨");  // 이 로그가 안 보이면 JS 자체가 안 도는 것.

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
    console.log("오디오 길이:", duration);

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
        repeat: defaultRepeat,
      });
      index++;
    }

    renderChunkList();
  };
});

// ===== 구간 목록 렌더링 =====
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
      playSection(chunk.start, chunk.start + chunk.duration, chunk.repeat);
    });

    row.appendChild(labelSpan);
    row.appendChild(timeSpan);
    row.appendChild(repeatWrapper);
    row.appendChild(playButton);

    chunkListEl.appendChild(row);
  });
}

// ===== 단일 구간 재생 (초기 버전 느낌으로 단순하게) =====
function playSection(start, end, repeatCount) {
  let count = 0;
  const rate = getPlaybackRate();
  audioElement.playbackRate = rate;

  function playOnce() {
    count++;
    audioElement.currentTime = start;
    audioElement.play();

    const handler = () => {
      if (audioElement.currentTime >= end || audioElement.ended) {
        audioElement.pause();
        audioElement.removeEventListener("timeupdate", handler);
        if (count < repeatCount) {
          playOnce();
        }
      }
    };

    audioElement.addEventListener("timeupdate", handler);
  }

  playOnce();
}

// ===== 전체 재생 (간단 버전) =====
let isPlayingAll = false;

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

  const rate = getPlaybackRate();
  audioElement.playbackRate = rate;

  // 재생 계획 만들기
  const plan = [];
  for (let g = 0; g < globalRepeat; g++) {
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

  if (plan.length === 0) return;

  isPlayingAll = true;
  playAllButton.disabled = true;

  let idx = 0;

  function playNext() {
    if (idx >= plan.length) {
      isPlayingAll = false;
      playAllButton.disabled = false;
      return;
    }

    const seg = plan[idx];
    idx++;

    audioElement.currentTime = seg.start;
    audioElement.play();

    const handler = () => {
      if (audioElement.currentTime >= seg.end || audioElement.ended) {
        audioElement.pause();
        audioElement.removeEventListener("timeupdate", handler);
        playNext();
      }
    };

    audioElement.addEventListener("timeupdate", handler);
  }

  playNext();
});

// 일시정지 / 다시 재생 (전체/단일 공통)
pauseButton.addEventListener("click", () => {
  if (audioElement.paused) {
    audioElement.play().catch(console.error);
    pauseButton.textContent = "일시정지";
  } else {
    audioElement.pause();
    pauseButton.textContent = "다시 재생";
  }
});

// 정지
stopButton.addEventListener("click", () => {
  audioElement.pause();
  audioElement.currentTime = 0;
  isPlayingAll = false;
  playAllButton.disabled = false;
  pauseButton.textContent = "일시정지";
});
