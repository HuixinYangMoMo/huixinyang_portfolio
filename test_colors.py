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

fg = arr.copy()
fg[bg_mask, 3] = 0
Image.fromarray(fg).save("assets/images/pixel/hallway_fg.png")

bg = arr.copy()
bg[~bg_mask, 3] = 0
Image.fromarray(bg).save("assets/images/pixel/hallway_bg.png")

print("Saved based on r > g logic!")
