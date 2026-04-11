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
  const prompts = [
    "holographic pure cyan and deep emerald green jellyfish, extremely long flowing tentacles, deep sea radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, no yellow, no warm colors, glowing bioluminescence, photorealistic point cloud",
    "holographic deep blue and neon cyan jellyfish, glowing bell with delicate point cloud radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, pure cool tones, no yellow, deep sea glowing bioluminescence",
    "holographic emerald green and cyan jellyfish, dynamic angle, point cloud radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, pure cool tones, no yellow, deep sea glowing bioluminescence"
  ];

  for (let i = 0; i < 3; i++) {
    console.log(`Generating jellyfish ${i+1}...`);
    try {
      const output = await wavespeed.run(
        "wavespeed-ai/z-image/turbo",
        { prompt: prompts[i], image_size: "landscape_16_9" }
      );
      await downloadFile(output.outputs[0], `assets/images/jelly/cool_j${i+1}.jpeg`);
      console.log(`Done: assets/images/jelly/cool_j${i+1}.jpeg`);
    } catch (e) {
      console.error(`Failed ${i+1}:`, e.message);
    }
  }
}
run();
