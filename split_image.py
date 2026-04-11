import numpy as np
from PIL import Image
import os

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
arr = np.array(img)
r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

# Refined Heuristic for Structure vs Sky
# Sky is predominantly purple, blue, cyan. 
# Structure is white/grey clouds, brown wood, black outlines, green plants.
is_grey = (np.abs(r - g) < 25) & (np.abs(g - b) < 25) & (np.abs(r - b) < 25)
is_cloud = is_grey & (r > 100)
is_warm = (r > b + 5) & (r > 50)
is_dark = (r < 65) & (g < 65) & (b < 65)
is_plant = (g > r + 10) & (g > b + 5)

is_structure = is_cloud | is_warm | is_dark | is_plant

fg = arr.copy()
fg[~is_structure, 3] = 0
Image.fromarray(fg).save("assets/images/pixel/hallway_fg.png")

bg = arr.copy()
bg[is_structure, 3] = 0
Image.fromarray(bg).save("assets/images/pixel/hallway_bg.png")

print("Saved foreground and background layers.")
