from PIL import Image
import numpy as np

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
arr = np.array(img)
h, w = arr.shape[:2]

bg_mask = np.ones((h, w), dtype=bool)

# Let's inspect the original image and define the bounding boxes roughly.
# It's an 888x500 image, horizontally extended by me in a previous python script!
# Wait, the new image has:
# center_x = (888 - 500) // 2 = 194
# The original center part is x=194 to x=694 (width 500)
# The left part is x=0 to 194 (mirrored from x=194 to 388)
# The right part is x=694 to 888 (mirrored from x=694-194=500 to 694)

# Let's write a more robust color threshold that isolates ONLY the very specific sky colors.
r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

# Sky is typically #a29bfe or similar (Light Purple / White Clouds)
# R, G, B ranges for sky and clouds:
# Sky: blueish purple. b is high, r and g are lower but close.
is_sky_color = (b > g + 10) & (b > r) & (r > 100) & (g > 100)
is_white_cloud = (r > 200) & (g > 200) & (b > 200)

bg_mask = is_sky_color | is_white_cloud

# Ceiling window has dark blue/cyan water and black fish. It is NOT white cloud and NOT sky purple.
# Ceiling window water is b>r but g is also high (cyan/greenish).
# is_sky_color excludes green>blue, so it should naturally exclude cyan water!
# The fish are black, which is also excluded.
# So bg_mask should already exclude the ceiling window!

# Floating windows show landscapes, sunsets (red/yellow), trees (green), buildings.
# All of these are excluded from is_sky_color and is_white_cloud!
# EXCEPT if there are white clouds inside the floating window...
# But those clouds being static or characters is fine!

# Let's save this simple color-based mask.
fg = arr.copy()
fg[bg_mask, 3] = 0
Image.fromarray(fg).save("assets/images/pixel/hallway_fg.png")

bg = arr.copy()
bg[~bg_mask, 3] = 0
Image.fromarray(bg).save("assets/images/pixel/hallway_bg.png")

print("Saved mask based on color!")
