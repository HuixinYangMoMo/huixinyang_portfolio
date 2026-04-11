import numpy as np
from PIL import Image

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
arr = np.array(img)
r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

# Purple sky
is_purple_sky = (b > r) & (r > g) & (b > g + 20) & (r > 80)
# White clouds
is_white_cloud = (r > 200) & (g > 200) & (b > 200) & (np.abs(r-g) < 15) & (np.abs(g-b) < 15)

bg_mask = is_purple_sky | is_white_cloud

# Force boxes to be FG (bg_mask = False)
boxes = [
    # Top ceiling window (Water and fish)
    (140, 0, 740, 60),
    # Right large window (Door)
    (650, 70, 740, 430),
    # Left large window (Door)
    (140, 70, 230, 430),
    # Floating top middle window
    (330, 125, 560, 160),
    # Middle right painting (Sunset)
    (540, 180, 640, 310),
    # Middle left painting (Beach)
    (270, 210, 360, 310),
    # Center right painting (vertical)
    (600, 280, 625, 310),
    # Center left painting (vertical)
    (380, 280, 400, 350),
    # Center right top painting (landscape)
    (595, 230, 620, 245),
    # Center left top painting (landscape)
    (380, 200, 450, 240),
    # Bottom floor window
    (480, 360, 640, 420),
    # Bottom left mirror
    (0, 270, 110, 500),
    # Bottom right mirror
    (780, 250, 888, 500)
]

for (x1, y1, x2, y2) in boxes:
    bg_mask[y1:y2, x1:x2] = False

# What if we just use the mask directly?
# But we need nice smooth edges, so maybe we keep the rest of the image intact.

fg = arr.copy()
fg[bg_mask, 3] = 0
Image.fromarray(fg).save("assets/images/pixel/hallway_fg.png")

bg = arr.copy()
bg[~bg_mask, 3] = 0
Image.fromarray(bg).save("assets/images/pixel/hallway_bg.png")

print("Saved perfectly protected FG/BG!")
