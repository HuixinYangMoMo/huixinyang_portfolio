import numpy as np
from PIL import Image
import sys
# Increase recursion depth for large images
sys.setrecursionlimit(2000000)

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
arr = np.array(img)
r, g, b, a = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int), arr[:,:,3].astype(int)

h, w = arr.shape[:2]

# Identify pixels that could potentially be "background sky"
# Sky is mostly light purple/blue and white clouds.
# Basically, anything that is NOT dark, NOT warm, NOT plant.
# Actually, the background sky is literally everywhere. 
# Let's define "wall/structure" borders as dark outlines or distinct colors.
# Since it's pixel art, it has dark outlines (r<100, g<100, b<100) around everything!
# So we can just say: all pixels that are NOT dark outlines.
# But wait, clouds inside windows are also not dark.
# If we flood-fill from (0,0) across non-outline pixels, we'll cover the whole sky and clouds,
# and stop at the dark outlines of the doors/windows!
# The ceiling window also has a dark outline!

is_outline = (r < 80) & (g < 80) & (b < 100)
# Also some brown wood could act as borders
is_wood = (r > b + 20) & (r > 60)

is_border = is_outline | is_wood

mask = np.zeros((h, w), dtype=bool)

# Flood fill queue
queue = []
# Start points (corners, or middle sides)
starts = [(0, 0), (h-1, 0), (0, w-1), (h-1, w-1), (h//2, 10), (h//2, w-10)]

for sy, sx in starts:
    if not is_border[sy, sx] and not mask[sy, sx]:
        queue.append((sy, sx))
        mask[sy, sx] = True

idx = 0
# Fast iterative flood fill
while idx < len(queue):
    cy, cx = queue[idx]
    idx += 1
    
    # 4 neighbors
    for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < h and 0 <= nx < w:
            if not mask[ny, nx] and not is_border[ny, nx]:
                mask[ny, nx] = True
                queue.append((ny, nx))

print("Flood fill reached:", len(queue), "pixels")

# The mask now contains the continuous background sky and clouds!
# However, there might be small gaps or noise.
# We can just say:
bg_mask = mask
fg_mask = ~mask

fg = arr.copy()
fg[bg_mask, 3] = 0
Image.fromarray(fg).save("assets/images/pixel/hallway_fg.png")

bg = arr.copy()
bg[fg_mask, 3] = 0
Image.fromarray(bg).save("assets/images/pixel/hallway_bg.png")

print("Saved foreground and background layers.")
