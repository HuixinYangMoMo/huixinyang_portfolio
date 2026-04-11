import numpy as np
from PIL import Image

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGB")
arr = np.array(img)
r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

# Let's define the sky:
# It's mostly purple/blue and white.
# The ceiling window is mostly cyan/green/blue and black.
# Doors are brown/red/yellow/black.

# We can create a mask where we manually define a polygon for the sky, or use flood fill?
# Actually, the sky is everywhere. 
# Let's save the mask to an image and inspect it.
