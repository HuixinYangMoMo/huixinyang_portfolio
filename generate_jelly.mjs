import wavespeed from 'wavespeed';
import fs from 'fs';
import https from 'https';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => res.pipe(file));
    file.on('finish', () => { file.close(); resolve(); });
    file.on('error', reject);
  });
}

async function run() {
  console.log("Generating jellyfish...");
  try {
    const output = await wavespeed.run(
      "wavespeed-ai/flux-dev/ultra",
      { 
        prompt: "holographic neon green and cyan jellyfish, intricate long flowing tentacles, deep sea terminal radar scan style, CRT monitor aesthetic, pitch black background, pixel perfect point cloud, highly detailed", 
        image_size: "landscape_16_9",
        num_inference_steps: 28,
        guidance_scale: 3.5
      }
    );
    await downloadFile(output["outputs"][0], "assets/new_jelly.png");
    console.log("Done: assets/new_jelly.png");
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
