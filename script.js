window.addEventListener("DOMContentLoaded", () => {
  // ===== 전역 상태 =====
  let chunks = [];              // { index, start, duration, repeat }
  let playMode = "none";        // "none" | "single" | "all"
  let playPlan = [];            // [{ start, end }]
  let playIndex = 0;            // 현재 재생 중인 playPlan 인덱스
  let isPaused = false;
  let lastObjectUrl = null;
  let segmentTimerId = null;
  let currentSegEnd = 0;        // 현재 구간의 끝 시각(원본 오디오 기준 초)

  // ===== DOM 요소 참조 (HTML의 id 그대로) =====
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

  // 필수 요소가 없으면 여기서 바로 중단
  if (
    !fileInput || !chunkSecondsInput || !defaultRepeatInput ||
    !cutButton || !chunkListEl || !globalRepeatInput ||
    !playbackRateSelect || !playAllButton || !pauseButton ||
    !stopButton || !audioElement
  ) {
    console.error("필수 DOM 요소 중 일부를 찾지 못했습니다.", {
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
    return;
  }

  // ===== 유틸 =====
  function formatTime(sec) {
    return sec.toFixed(1) + "s";
  }

  function getPlaybackRate() {
    const rate = parseFloat(playbackRateSelect.value);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }

  function clearSegmentTimer() {
    if (segmentTimerId !== null) {
      clearTimeout(segmentTimerId);
      segmentTimerId = null;
    }
  }

  function stopAllPlayback() {
    playMode = "none";
    playPlan = [];
    playIndex = 0;
    isPaused = false;
    currentSegEnd = 0;

    clearSegmentTimer();

    if (audioElement) {
      audioElement.pause();
      // audioElement.currentTime = 0; // 필요하면 주석 해제
    }

    playAllButton.disabled = false;
    pauseButton.textContent = "일시정지";
  }

  // ===== 1. 파일 자르기 =====
  function handleCut() {
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
