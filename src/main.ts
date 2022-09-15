import './style.css'
import SrtParser from 'srt-parser-2';
import IntervalTree from '@flatten-js/interval-tree'
import type { Line } from 'srt-parser-2';

const srtParser = new SrtParser();

const videoInputEl    = document.querySelector<HTMLInputElement>('input#input-video')!;
const srtInputEl      = document.querySelector<HTMLInputElement>('input#input-subs')!;
const videoButtonEl   = document.querySelector<HTMLButtonElement>('button#input-video')!;
const srtButtonEl     = document.querySelector<HTMLButtonElement>('button#input-subs')!;
const playerCanvasEl  = document.querySelector<HTMLCanvasElement>("canvas#player")!;
const playButtonEl    = document.querySelector<HTMLButtonElement>("button#play-pause")!;
const progressEl      = document.querySelector<HTMLProgressElement>("progress#seekbar")!;
const bgVideoEl: HTMLVideoElement = document.createElement("video")!;
const playerCanvasCtx = setupCanvas(playerCanvasEl);

// https://web.dev/canvas-hidipi/
// No more blurry text and image renders
function setupCanvas(canvas: HTMLCanvasElement) {
	// Get the device pixel ratio, falling back to 1.
	const dpr = window.devicePixelRatio || 1;
	// Get the size of the canvas in CSS pixels.
	const rect = canvas.getBoundingClientRect();
	// Give the canvas pixel dimensions of their CSS
	// size * the device pixel ratio.
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	const ctx = canvas.getContext('2d')!;
	// Scale all drawing operations by the dpr, so you
	// don't have to worry about the difference.
	ctx.scale(dpr, dpr);
	return ctx;
}

interface State {
	videoFile: File | null,
	srtFile: File | null,
	srtFileData: string | null,
	parsedSrt: [Line?]
	srtTree: IntervalTree,
	isPlaying: boolean,
	globalError: boolean,
	alternator: boolean,
}

const state : State = {
	videoFile: null,
	srtFile: null,
	srtFileData: null,
	parsedSrt: [],
	srtTree: new IntervalTree(),
	isPlaying: false, // otherwise paused
	globalError: false,
	alternator: false,
}

setInterval(() => state.alternator = !state.alternator, 3500);
// Ideally query segment tree of processing srtFileData
function getSubtitleText(timestamp: number) {
	const result = state.srtTree.search([timestamp, timestamp]);
	if (result.length == 0) return null;
	return result[0];
}

// TODO: Describe maths in comments
function maintainAspectRatio (video: HTMLVideoElement, canvas: HTMLCanvasElement) {
	const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
	const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
    const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
	return [x, y, video.videoWidth * scale, video.videoHeight * scale];
}

async function loadVideo(el: HTMLVideoElement, file: File) {
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
			const subtitleText = getSubtitleText(bgVideoEl.currentTime);
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

function validateVideoFile(file: File) {
	console.log("video selected", file);
	if (!file) return null;
	return file;
}

function validateSrtFile(file: File) {
	console.log("subs selected", file);
	if (!file) return null;
	return file;
}

function convertToMs(string: string): number {
	const colonSplit = string.split(':');
	const msSpit = colonSplit[2].split(',');
	const hrMs = parseInt(colonSplit[0]) * 3600; 
	const minMs = parseInt(colonSplit[1]) * 60;
	const secMs = parseInt(msSpit[0]);
	const ms = parseInt(msSpit[1]) / 1000;
	return hrMs + minMs + secMs + ms;
}

function makeSrtMap(srtLines: [Line?]) {
	for (const line of srtLines) {
		state.srtTree.insert([convertToMs(line?.startTime!), convertToMs(line?.endTime!)], line?.text);
	}
	return state.srtTree;
}

// Prepare video/input for "Video Input"
videoInputEl.addEventListener("change", async (ev: Event) => {
	const target = ev.target as HTMLInputElement;
	if (target.files!.length == 0) return;
	const videoFile = target.files?.item(0)!;
	videoButtonEl.classList.toggle("progress");
	state.videoFile = validateVideoFile(videoFile);
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
srtInputEl.addEventListener("change", async (ev: Event) => {
	const target = ev.target as HTMLInputElement;
	if (target.files!.length == 0) return;
	const srtFile = target.files?.item(0)!;
	srtButtonEl.classList.toggle("progress");
	state.srtFile = validateSrtFile(srtFile);
	if (!state.srtFile) return alert("Invalid SRT Input selected");
	
	try {
		state.srtFileData = await state.srtFile.text();
		if (!srtParser.correctFormat(state.srtFileData))
			throw new Error ("Incorrect srt format");
		state.parsedSrt = srtParser.fromSrt(state.srtFileData) as [Line];
		state.srtTree = makeSrtMap(state.parsedSrt);
		console.log(state.parsedSrt, "parsed srt file");
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
