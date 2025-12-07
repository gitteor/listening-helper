// ===== 전역 상태 =====
let chunks = []; // { index, start, duration, repeat }

// ===== DOM 요소 (질문에서 주신 HTML id 기준) =====
const fileInput          = document.getElementById("audioFile");
const chunkSecondsInput  = document.getElementById("chunkSeconds");
const defaultRepeatInput = document.getElementById("defaultRepeat");
const cutButton          = document.getElementById("cutButton");
const chunkListEl        = document.getElementById("chunkList");

const globalRepeatInput  = document.getElementById("globalRepeat");   // 지금은 안 씀(나중 확장)
const playbackRateSelect = document.getElementById("playbackRate");
const playAllButton      = document.getElementById("playAllButton");  // 지금은 안 씀(나중 확장)
const pauseButton        = document.getElementById("pauseButton");    // 지금은 안 씀(나중 확장)
const stopButton         = document.getElementById("stopButton");     // 지금은 안 씀(나중 확장)

const audioElement       = document.getElementById("audioPlayer");

// ===== 유틸 =====
function formatTime(sec) {
  return sec.toFixed(1) + "s";
}

function getPlaybackRate() {
  const rate = parseFloat(playbackRateSelect.value);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
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

  chunks.forEach((chunk) => {
    const row = document.createElement("div");
    row.className = "chunk-row";

    // 구간 번호
    const labelSpan = document.createElement("span");
    labelSpan.className = "chunk-label";
    labelSpan.textContent = `구간 ${chunk.index}`;

    // 시간 정보
    const timeSpan = document.createElement("span");
    timeSpan.className = "chunk-time";
    const startText = formatTime(chunk.start);
    const endText   = formatTime(chunk.start + chunk.duration);
    timeSpan.textContent = `(${startText} ~ ${endText})`;

    // 반복 입력
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

    // 이 구간 재생 버튼
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

// ===== 3. 단일 구간 재생 (반복 횟수 포함, 단순 버전) =====
function playSection(start, end, repeatCount) {
  let count = 0;
  const rate = getPlaybackRate();

  function playOnce() {
    count += 1;
    audioElement.currentTime = start;
    audioElement.playbackRate = rate;
    audioElement.play().catch((e) => {
      console.error("[DEBUG] 재생 에러:", e);
    });

    const handler = () => {
      if (audioElement.currentTime >= end) {
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
