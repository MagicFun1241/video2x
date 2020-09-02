import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as glob from "glob";
import * as nanoid from "nanoid";

import waifu2x from "waifu2x";

import {spawn} from "child_process";

import * as tempDirectory from "temp-dir";
import * as pathToFfmpeg from 'ffmpeg-static';
import {
    path as pathToFfprobe
} from "ffprobe-static";

import Algorithm from "./interfaces/algorithm";
import Options from "./interfaces/options";

const isDev = process.env.NODE_ENV === "development";
const tempPath = path.join(tempDirectory, "Video2X");

class Video2X {
    private readonly input: string;
    private readonly tempDirectory: string;
    private readonly algorithm: Algorithm;

    constructor(options: Options) {
        this.input = options.input;
        this.tempDirectory = path.join(tempPath, nanoid.nanoid(12));

        this.algorithm = options?.algorithm ? options.algorithm : (os.platform() === "win32") ? Algorithm.Anime4K : Algorithm.Waifu2X;

        if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath);
        }

        if (!fs.existsSync(this.tempDirectory)) {
            fs.mkdirSync(this.tempDirectory);
        }
    }

    upscale(output: string) {
        return new Promise((resolve, reject) => {
            switch (this.algorithm) {
                case Algorithm.Waifu2X:
                    this.getFps().then(fps => {
                        // TODO: Write logger
                        this.extractFrames().then(() => {

                            this.upscaleFrames().then(() => {

                                this.extractAudio("input.mp4", "audio.aac").then(() => {

                                    this.mergeFrames("merged.mp4", fps).then(() => {

                                        this.mergeAudio("merged.mp4", "audio.aac", output).then(() => {
                                            resolve();
                                        });
                                    });
                                });
                            });
                        });
                    });
                    break;

                case Algorithm.Anime4K:
                    break;
            }
        });
    }

    private extractFrames() {
        let process = spawn(pathToFfmpeg, [
            `-i`,
            this.input,
            "-r",
            "24/1",
            `${this.tempDirectory}/%03d.bmp`
        ]);

        if (isDev) this.registerLogging(process);

        return new Promise((resolve, reject) => {
            process.on("close", code => {
                resolve();
            });
        });
    }

    private mergeFrames(output: string, fps: number = 24) {
        let process = spawn(pathToFfmpeg, [
            "-y",
            "-r",
            "24/1",
            `-i`,
            `${path.join(this.tempDirectory, "upscaled")}/%03d.bmp`,
            "-c:v",
            "libx264",
            "-vf",
            `fps=${fps}`,
            "-pix_fmt",
            "yuv420p",
            output
        ]);

        if (isDev) this.registerLogging(process);

        return new Promise((resolve, reject) => {
            process.on("close", code => {
                resolve();
            });
        });
    }

    private getFps() {
        let process = spawn(pathToFfprobe, [
            "-v",
            "error",
            "-select_streams",
            "v",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            "-show_entries",
            "stream=r_frame_rate",
            this.input
        ]);

        return new Promise<number>(resolve => {
            process.stdout.on('data', (data) => {
                data = data.toString();
                data = data.split("/").map(e => parseInt(e));
                resolve(Math.round(data[0] / data[1]));
            });
        });
    }

    private mergeAudio(video: string, audio: string, output: string) {
        let process = spawn(pathToFfmpeg, [
            "-y",
            "-i",
            video,
            "-i",
            audio,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            output
        ]);

        if (isDev) this.registerLogging(process);

        return new Promise((resolve, reject) => {
            process.on("close", code => {
                resolve();
            });
        });
    }

    private extractAudio(input: string, output: string) {
        let process = spawn(pathToFfmpeg, [
            "-y",
            "-i",
            input,
            "-vn",
            "-acodec",
            "copy",
            output
        ]);

        if (isDev) this.registerLogging(process);

        return new Promise((resolve, reject) => {
            process.on("close", code => {
                resolve();
            });
        });
    }

    private upscaleFrames() {
        return new Promise(resolve => {
            glob("*.bmp", {
                cwd: this.tempDirectory,
                absolute: true
            }, (err, files) => {
                const upscaledDir = path.join(this.tempDirectory, "upscaled");

                files.forEach(e => {
                    waifu2x.upscaleImage(path.relative(process.cwd(), e), path.join(path.relative(process.cwd(), upscaledDir), path.basename(e)));
                });

                resolve();
            });
        });
    }

    private registerLogging(process) {
        process.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
          
        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
    }
}

function video2x(input: string, options: Options = { input: input }) {
    return new Video2X(options);
}

export default video2x;