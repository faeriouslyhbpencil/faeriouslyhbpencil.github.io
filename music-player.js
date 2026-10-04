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
const ipodScreen = document.querySelector(".ipod-screen");
let playlistMenuOpen = false;
const playlistMenuStyle = document.createElement("style");
playlistMenuStyle.textContent = `
  .ipod-screen.playlist-open #album-art,
  .ipod-screen.playlist-open .track-info { display: none; }
  .playlist-screen {
    display: none;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    text-align: left;
  }
  .ipod-screen.playlist-open .playlist-screen { display: flex; }
  .playlist-screen-title {
    flex: 0 0 auto;
    margin: 0 0 3px;
    color: #1e3a8a;
    font-size: 10px;
    font-weight: bold;
  }
  .playlist-screen-tracks {
    display: grid;
    flex: 1;
    gap: 1px;
    min-height: 0;
    overflow-y: auto;
    width: 100%;
  }
  .playlist-screen-track {
    display: grid;
    gap: 1px;
    width: 100%;
    padding: 3px 2px;
    border: 0;
    border-bottom: 1px solid #bfdbfe;
    background: transparent;
    color: #1e3a8a;
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    text-align: left;
  }
  .playlist-screen-track[aria-current="true"] { background: #dbeafe; }
  .playlist-screen-artist { color: #475569; font-size: 9px; }
`;
document.head.appendChild(playlistMenuStyle);

const playlistScreen = document.createElement("div");
playlistScreen.className = "playlist-screen";
const playlistScreenTitle = document.createElement("div");
playlistScreenTitle.className = "playlist-screen-title";
playlistScreenTitle.textContent = "Songs";
const playlistScreenTracks = document.createElement("div");
playlistScreenTracks.className = "playlist-screen-tracks";
const playlistMenuButtons = playlist.map((track, index) => {
  const button = document.createElement("button");
  button.className = "playlist-screen-track";
  button.type = "button";
  button.setAttribute("aria-current", index === currentTrackIndex ? "true" : "false");
  const title = document.createElement("span");
  title.textContent = track.title;
  const artist = document.createElement("span");
  artist.className = "playlist-screen-artist";
  artist.textContent = track.artist;
  button.append(title, artist);
  button.addEventListener("click", () => {
    setPlaylistMenuOpen(false);
    changeTrack(index - currentTrackIndex);
  });
  playlistScreenTracks.appendChild(button);
  return button;
});
playlistScreen.append(playlistScreenTitle, playlistScreenTracks);
ipodScreen.appendChild(playlistScreen);
function setPlaylistMenuOpen(isOpen) {
  playlistMenuOpen = isOpen;
  ipodScreen.classList.toggle("playlist-open", isOpen);
  ipodStatus.textContent = isOpen
    ? "Song List"
    : audio.error
      ? "Audio unavailable"
      : audio.paused ? "Paused" : "Now Playing";
}

menuButton?.removeAttribute("onclick");
menuButton?.addEventListener("click", () => setPlaylistMenuOpen(!playlistMenuOpen));

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
