const video2x = require("../lib").default;

video2x("input.mp4").upscale("result.mp4").then(() => {
    console.log("Done!");
});