from PIL import Image
import numpy as np

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGB")
w, h = img.size
print(w, h)
