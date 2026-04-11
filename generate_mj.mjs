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
  const prompt = "pixel art infinite surreal hallway, 16-bit retro game style, floating doors and windows on the walls, white clouds and purple sky filling the room, dreamcore vaporwave aesthetic, dithered shading, highly detailed pixel art, landscape --ar 16:9";

  console.log(`Generating image...`);
  try {
    const output = await wavespeed.run(
      "wavespeed-ai/flux-dev/ultra",
      { prompt: prompt, image_size: "landscape_16_9" }
    );
    await downloadFile(output.outputs[0], `assets/images/hallway.jpeg`);
    console.log(`Done!`);
  } catch (e) {
    console.error(`Failed:`, e.message);
  }
}
run();
