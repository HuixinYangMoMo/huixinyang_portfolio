from PIL import Image
import numpy as np

img = Image.open("assets/images/pixel/hallway_bg.png").convert("RGBA")
arr = np.array(img)
h, w = arr.shape[:2]

# Print a small 40x20 preview of the ceiling window area.
# Ceiling window is roughly top middle (x = 300 to 588, y = 0 to 100)
# We sample every 5th pixel.
for y in range(0, 100, 5):
    line = ""
    for x in range(300, 588, 5):
        if arr[y, x, 3] > 0: # Is background (sky)
            line += "."
        else: # Is foreground (ceiling window)
            line += "X"
    print(line)
