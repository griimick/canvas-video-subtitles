import './style.css'

const videoInputEl    = document.querySelector<HTMLInputElement>('input#input-video')!;
const srtInputEl      = document.querySelector<HTMLInputElement>('input#input-subs')!;
const videoButtonEl   = document.querySelector<HTMLButtonElement>('button#input-video')!;
const srtButtonEl     = document.querySelector<HTMLButtonElement>('button#input-subs')!;
const bgVideoEl       = document.createElement<HTMLVideoElemnt>("video");
const playerCanvasEl  = document.querySelector<HTMLCanvasElement>("canvas#player")!;
const playButtonEl    = document.querySelector<HTMLButtonElement>("button#play-pause")!;
const progressEl      = document.querySelector<HTMLProgressElement>("progress#seekbar")!;
const playerCanvasCtx = setupCanvas(playerCanvasEl);

// https://web.dev/canvas-hidipi/
// No more blurry text and image renders
function setupCanvas(canvas) {
	// Get the device pixel ratio, falling back to 1.
	const dpr = window.devicePixelRatio || 1;
	// Get the size of the canvas in CSS pixels.
	const rect = canvas.getBoundingClientRect();
	// Give the canvas pixel dimensions of their CSS
	// size * the device pixel ratio.
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	const ctx = canvas.getContext('2d');
	// Scale all drawing operations by the dpr, so you
	// don't have to worry about the difference.
	ctx.scale(dpr, dpr);
	return ctx;
}

const state = {
	videoInputFile: null,
	srtInputFile: null,
	videoFileData: null,
	srtFileData: null,
	isPlaying: false, // otherwise paused
	globalError: false,
}

// Ideally query segment tree of processing srtFileData
function getSubtitleText(timestamp, map) {
	return "Hello World! THIS ISTINASD \n sdasd";
}

// TODO: Describe maths in comments
function maintainAspectRatio (video, canvas) {
	const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
	const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
    const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
	return [x, y, video.videoWidth * scale, video.videoHeight * scale];
}

async function loadVideo(el, file) {
	const fileURL = URL.createObjectURL(file)
	el.src = fileURL;
	// when video starts playing
	bgVideoEl.addEventListener('play', () => {
			const resizedDims = maintainAspectRatio(bgVideoEl, playerCanvasEl);
			console.log(resizedDims);
		function step() {
			// render frame
			playerCanvasCtx.drawImage(bgVideoEl, resizedDims[0], resizedDims[1], resizedDims[2], resizedDims[3]);
			playerCanvasCtx.save();

			// render subtitles
			// TODO: Line break and stuff !!!
			const subtitleText = getSubtitleText(bgVideoEl.duration);
			if (subtitleText) {
				// highlight text
				const width = playerCanvasCtx.measureText(subtitleText).width;
				const padding = 10;
				playerCanvasCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
				// paint text background, explain in comments
				playerCanvasCtx.fillRect(
					playerCanvasEl.width / 2 - width/2 - padding/2,
					playerCanvasEl.height * 0.85 - 24, width + padding,
					parseInt(playerCanvasCtx.font, 10) + padding
				);
				playerCanvasCtx.save();
				// render text
				playerCanvasCtx.textAlign = "center";
				playerCanvasCtx.fillStyle = "#fff";
				playerCanvasCtx.font = "normal 24px Arial";
				playerCanvasCtx.fillText(subtitleText, playerCanvasEl.width / 2, playerCanvasEl.height * 0.85);
			}
			requestAnimationFrame(step)
		}
		requestAnimationFrame(step);
	});
	// seekbar value calculation
	bgVideoEl.addEventListener("timeupdate", () => {
		const percentage = ( bgVideoEl.currentTime / bgVideoEl.duration ) * 100;
		progressEl.value = percentage;
	});
	// seekbar functionality
	progressEl.addEventListener("click", (ev) => {
		const rect = progressEl.getBoundingClientRect();
		const offset = {
			top: rect.top + window.scrollY, 
			left: rect.left + window.scrollX,
		};
		const left = (ev.pageX - offset.left);
		const totalWidth = progressEl.clientWidth;
		const percentage = ( left / totalWidth );
		const seekTime = bgVideoEl.duration * percentage;
		bgVideoEl.currentTime = seekTime;
	});
	// when video is ready to play
	bgVideoEl.addEventListener ("canplay", () => {
		playButtonEl.addEventListener("click", async () => {
			if (state.isPlaying) {
				await bgVideoEl.pause();
				playButtonEl.innerHTML = "Play";
			} else {
				await bgVideoEl.play();
				playButtonEl.innerHTML = "Pause";
			}
		});
		bgVideoEl.addEventListener("play", () => {
			state.isPlaying = true;
		});
		bgVideoEl.addEventListener("pause", () => {
			state.isPlaying = false;
		});
	});
}

async function readFile (file) {
	return await file.text()
}

function validateVideoFile(ev) {
	console.log("video selected", ev.target.files);
	const [file] = ev.target.files
	if (!file) return;
	// if (!bgVideoEl.canPlayType(file.type)) return;
	return file;
}

function validateSrtFile(ev) {
	console.log("subs selected", ev.target.files);
	const [file] = ev.target.files
	if (!file) return
	return file;
}

// Prepare video/input for "Video Input"
videoInputEl.addEventListener("change", async (ev) => {
	if (ev.target.files.length == 0) return;
	videoButtonEl.classList.toggle("progress");
	state.videoFile = validateVideoFile(ev);
	if (!state.videoFile) return alert("Invalid Video Input selected");

	try {
	}
	catch(err) {
		console.error(err, "Error reading Video File");
		alert("Error reading Video File");
		return;
	}
	finally {
		videoButtonEl.classList.toggle("progress");
	}
	videoButtonEl.classList.toggle("success");
	loadVideo(bgVideoEl, state.videoFile);
});

// Prepare video/input for "SRT Input"
srtInputEl.addEventListener("change", async (ev) => {
	if (ev.target.files.length == 0) return;
	srtButtonEl.classList.toggle("progress");
	state.srtFile = validateSrtFile(ev);
	if (!state.srtFile) return alert("Invalid SRT Input selected");
	
	try {
		state.srtFileData = await readFile(state.srtFile);
	}
	catch(err) {
		console.error(err, "Error reading SRT File");
		alert("Error reading SRT File");
		return;
	}
	finally {
		srtButtonEl.classList.toggle("progress");
	}
	srtButtonEl.classList.toggle("success");
	// create a segment tree out of srt data to make range queries per frame
});

videoButtonEl.addEventListener("click", () => {
	videoInputEl.click();
});
srtButtonEl.addEventListener("click", () => {
	srtInputEl.click();
});
