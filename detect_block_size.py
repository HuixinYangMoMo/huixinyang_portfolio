from PIL import Image
import numpy as np

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGB")
arr = np.array(img)
h, w = arr.shape[:2]

# Find horizontal block size
diffs_x = np.any(arr[:, 1:] != arr[:, :-1], axis=2)
transitions_x = np.where(diffs_x[h//2])[0]
if len(transitions_x) > 1:
    block_w = np.median(np.diff(transitions_x))
else:
    block_w = 1

# Find vertical block size
diffs_y = np.any(arr[1:, :] != arr[:-1, :], axis=2)
transitions_y = np.where(diffs_y[:, w//2])[0]
if len(transitions_y) > 1:
    block_h = np.median(np.diff(transitions_y))
else:
    block_h = 1

print(f"Detected block size: {block_w}x{block_h}")
