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

const menuButton = document.querySelector(".wheel-btn.menu");
const playlistMenuStyle = document.createElement("style");
playlistMenuStyle.textContent = `
  .playlist-menu {
    box-sizing: border-box;
    width: min(360px, calc(100vw - 32px));
    max-height: min(80vh, 540px);
    padding: 16px;
    border: 2px solid #5ab2f5;
    border-radius: 10px;
    background: #eff6ff;
    color: #1e3a8a;
    font-family: inherit;
  }
  .playlist-menu::backdrop { background: rgba(15, 23, 42, 0.45); }
  .playlist-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .playlist-menu-title { margin: 0; font-size: 1.1rem; }
  .playlist-menu-close {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 1.4rem;
  }
  .playlist-menu-tracks { display: grid; gap: 6px; }
  .playlist-menu-track {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #93c5fd;
    border-radius: 6px;
    background: #ffffff;
    color: #1e3a8a;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .playlist-menu-track:hover,
  .playlist-menu-track[aria-current="true"] { background: #dbeafe; }
  .playlist-menu-artist { font-size: 0.85em; }
`;
document.head.appendChild(playlistMenuStyle);

const playlistMenu = document.createElement("dialog");
playlistMenu.className = "playlist-menu";
playlistMenu.setAttribute("aria-labelledby", "playlist-menu-title");
const playlistMenuHeader = document.createElement("div");
playlistMenuHeader.className = "playlist-menu-header";
const playlistMenuTitle = document.createElement("h2");
playlistMenuTitle.className = "playlist-menu-title";
playlistMenuTitle.id = "playlist-menu-title";
playlistMenuTitle.textContent = "Choose a song";
const playlistMenuClose = document.createElement("button");
playlistMenuClose.className = "playlist-menu-close";
playlistMenuClose.type = "button";
playlistMenuClose.setAttribute("aria-label", "Close song list");
playlistMenuClose.textContent = "×";
playlistMenuHeader.append(playlistMenuTitle, playlistMenuClose);
const playlistMenuTracks = document.createElement("div");
playlistMenuTracks.className = "playlist-menu-tracks";
const playlistMenuButtons = playlist.map((track, index) => {
  const button = document.createElement("button");
  button.className = "playlist-menu-track";
  button.type = "button";
  button.setAttribute("aria-current", index === currentTrackIndex ? "true" : "false");
  const title = document.createElement("span");
  title.textContent = track.title;
  const artist = document.createElement("span");
  artist.className = "playlist-menu-artist";
  artist.textContent = track.artist;
  button.append(title, artist);
  button.addEventListener("click", () => {
    playlistMenu.close();
    changeTrack(index - currentTrackIndex);
  });
  playlistMenuTracks.appendChild(button);
  return button;
});
playlistMenu.append(playlistMenuHeader, playlistMenuTracks);
document.body.appendChild(playlistMenu);
menuButton?.removeAttribute("onclick");
menuButton?.addEventListener("click", () => playlistMenu.showModal());
playlistMenuClose.addEventListener("click", () => playlistMenu.close());
playlistMenu.addEventListener("click", (event) => {
  if (event.target === playlistMenu) playlistMenu.close();
});
playlistMenu.addEventListener("close", () => menuButton?.focus());

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
  playlistMenuButtons.forEach((button, trackIndex) => {
    button.setAttribute("aria-current", trackIndex === index ? "true" : "false");
  });
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
