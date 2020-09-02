const {
    Video2X,
    Algorithm
} = require("../lib");

new Video2X({
    input: "input.mp4",
    algorithm: Algorithm.Waifu2X
}).upscale("output.mp4").then(() => {
    console.log("Done!");
});