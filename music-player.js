const playlist = [
  { title: "Sugar", artist: "BROCKHAMPTON", cover: "sugar.jpeg", audioSrc: "SUGAR.mp3" },
  { title: "Impossible", artist: "Clairo", cover: "impossible.jpeg", audioSrc: "Impossible.mp3" },
  { title: "Write me a letter", artist: "Beabadoobee", cover: "write me a letter.jpeg", audioSrc: "Write-Me-A-Letter.mp3" },
  { title: "Cowboys and angels", artist: "George Michael", cover: "cowboys and angels.jpg", audioSrc: "Cowboys-and-Angels.mp3" },
  { title: "Verte asi", artist: "Temple sour", cover: "verte asi .jpeg", audioSrc: "Verte-Asi.mp3" },
  { title: "Earrings", artist: "Malcolm Todd", cover: "earrings.jpeg", audioSrc: "Earrings.mp3" }
];

let currentTrackIndex = 0;
const musicDirectory = new URL("music/", document.currentScript.src);
const audio = document.getElementById("audio-player");
const songTitle = document.getElementById("song-title");
const artistName = document.getElementById("artist-name");
const albumArt = document.getElementById("album-art");
const ipodStatus = document.getElementById("ipod-status");
const playbackStorageKey = "hb-pencil-player-state";
const playbackChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("hb-pencil-audio") : null;
let lastLocalPlayAt = 0;
let currentAudioObjectUrl = null;
let shouldResumePlayback = false;
let lastProgressSaveAt = 0;

function readPlaybackState() {
  try {
    const savedState = JSON.parse(sessionStorage.getItem(playbackStorageKey));
    if (Number.isInteger(savedState?.trackIndex) && savedState.trackIndex >= 0 && savedState.trackIndex < playlist.length) {
      return { ...savedState, wasPlaying: savedState.wasPlaying === true };
    }
  } catch {}
  return null;
}

const savedPlaybackState = readPlaybackState();
if (savedPlaybackState) currentTrackIndex = savedPlaybackState.trackIndex;
shouldResumePlayback = savedPlaybackState?.wasPlaying === true;

function savePlaybackState(wasPlaying = shouldResumePlayback) {
  try {
    sessionStorage.setItem(playbackStorageKey, JSON.stringify({
      trackIndex: currentTrackIndex,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      wasPlaying
    }));
  } catch {}
}

window.addEventListener("pagehide", () => savePlaybackState());

function loadTrack(index) {
  const track = playlist[index];
  if (currentAudioObjectUrl) {
    URL.revokeObjectURL(currentAudioObjectUrl);
    currentAudioObjectUrl = null;
  }
  audio.src = new URL(track.audioSrc, musicDirectory).href;
  audio.load();
  songTitle.textContent = track.title;
  artistName.textContent = track.artist;
  albumArt.src = new URL(track.cover, musicDirectory).href;
}

function togglePlay() {
  if (audio.paused) {
    shouldResumePlayback = true;
    audio.play().catch(() => {
      shouldResumePlayback = false;
      savePlaybackState(false);
      ipodStatus.textContent = "Paused";
    });
  } else {
    shouldResumePlayback = false;
    savePlaybackState(false);
    audio.pause();
  }
}

function changeTrack(direction) {
  shouldResumePlayback = true;
  currentTrackIndex = (currentTrackIndex + direction + playlist.length) % playlist.length;
  loadTrack(currentTrackIndex);
  audio.play().catch(() => {
    shouldResumePlayback = false;
    savePlaybackState(false);
    ipodStatus.textContent = "Paused";
  });
}

function nextSong() { changeTrack(1); }
function prevSong() { changeTrack(-1); }

audio.addEventListener("play", () => {
  shouldResumePlayback = true;
  lastLocalPlayAt = Date.now();
  ipodStatus.textContent = "Now Playing";
  savePlaybackState(true);
  playbackChannel?.postMessage({ type: "play", startedAt: lastLocalPlayAt });
});
audio.addEventListener("pause", () => { ipodStatus.textContent = "Paused"; });
audio.addEventListener("timeupdate", () => {
  if (Date.now() - lastProgressSaveAt >= 1000) {
    lastProgressSaveAt = Date.now();
    savePlaybackState();
  }
});
audio.addEventListener("ended", () => {
  changeTrack(1);
});
audio.addEventListener("error", () => { ipodStatus.textContent = "Audio unavailable"; });
playbackChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "play" && event.data.startedAt > lastLocalPlayAt && !audio.paused) {
    shouldResumePlayback = false;
    audio.pause();
    savePlaybackState(false);
  }
});
loadTrack(currentTrackIndex);

if (savedPlaybackState) {
  const restorePlayback = async () => {
    const savedTime = Number(savedPlaybackState.currentTime);
    if (Number.isFinite(savedTime) && savedTime > 0) {
      try {
        const trackUrl = new URL(playlist[currentTrackIndex].audioSrc, musicDirectory);
        const response = await fetch(trackUrl);
        if (!response.ok) throw new Error(`Audio request returned ${response.status}`);
        currentAudioObjectUrl = URL.createObjectURL(await response.blob());
        audio.src = currentAudioObjectUrl;
        audio.load();
        if (audio.readyState < 1) {
          await new Promise(resolve => audio.addEventListener("loadedmetadata", resolve, { once: true }));
        }
      } catch {}

      const canSeek = Array.from({ length: audio.seekable.length }, (_, index) => index)
        .some(index => savedTime >= audio.seekable.start(index) && savedTime <= audio.seekable.end(index));
      if (canSeek) {
        const targetTime = Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.min(savedTime, audio.duration - 0.1)
          : savedTime;
        try {
          await new Promise(resolve => {
            let timer;
            const finish = () => {
              window.clearTimeout(timer);
              audio.removeEventListener("seeked", finish);
              audio.removeEventListener("error", finish);
              resolve();
            };
            audio.addEventListener("seeked", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });
            timer = window.setTimeout(finish, 2000);
            audio.currentTime = targetTime;
            if (!audio.seeking && Math.abs(audio.currentTime - targetTime) < 0.05) finish();
          });
        } catch {}
      }
    }
    if (shouldResumePlayback) {
      audio.play().catch(() => {
        shouldResumePlayback = false;
        savePlaybackState(false);
        ipodStatus.textContent = "Paused";
      });
    }
  };

  if (audio.readyState >= 1) {
    restorePlayback();
  } else {
    audio.addEventListener("loadedmetadata", restorePlayback, { once: true });
  }
}
