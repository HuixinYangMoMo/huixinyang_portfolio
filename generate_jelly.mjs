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
    "holographic cyan and neon green jellyfish, large bell with delicate point cloud radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, pure cyan and green, deep sea glowing bioluminescence",
    "holographic neon cyan jellyfish, extremely long flowing tentacles, point cloud radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, pure cyan and green, deep sea glowing bioluminescence",
    "holographic neon green jellyfish, dynamic angle, point cloud radar scan style, CRT monitor aesthetic, isolated on pitch black background, highly detailed, pure cyan and green, deep sea glowing bioluminescence"
  ];

  for (let i = 0; i < 3; i++) {
    console.log(`Generating jellyfish ${i+1}...`);
    try {
      const output = await wavespeed.run(
        "wavespeed-ai/z-image/turbo",
        { prompt: prompts[i], image_size: "landscape_16_9" }
      );
      await downloadFile(output.outputs[0], `assets/images/jelly/new_j${i+1}.jpeg`);
      console.log(`Done: assets/images/jelly/new_j${i+1}.jpeg`);
    } catch (e) {
      console.error(`Failed ${i+1}:`, e.message);
    }
  }
}
run();
