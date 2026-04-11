from PIL import Image, ImageDraw
import json

boxes = [
    # Top ceiling window (Water and fish)
    (140, 0, 740, 60),
    # Top right window
    (790, 20, 888, 120),
    # Top left window
    (0, 20, 90, 120),
    # Right large window (Door)
    (650, 70, 740, 430),
    # Left large window (Door)
    (140, 70, 230, 430),
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
    # Bottom left window (glass)
    (150, 450, 430, 500),
    # Bottom left mirror
    (0, 270, 110, 500),
    # Bottom right mirror
    (780, 250, 888, 500),
    # Floating top middle window
    (330, 125, 560, 160)
]

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
draw = ImageDraw.Draw(img)
for b in boxes:
    draw.rectangle(b, outline="red", width=2)
img.save("boxes.png")

with open("boxes.json", "w") as f:
    json.dump(boxes, f)
