from PIL import Image, ImageDraw

img = Image.open("assets/images/pixel/original_hallway.png").convert("RGBA")
w, h = img.size

boxes = [
    # Top ceiling window
    (240, 0, 640, 100),
    # Top right window
    (750, 20, 888, 120),
    # Top left window
    (0, 20, 138, 120),
    # Right large window
    (670, 140, 820, 480),
    # Left large window
    (70, 140, 220, 480),
    # Middle right painting
    (540, 200, 610, 360),
    # Middle left painting
    (280, 200, 350, 360),
    # Center right painting
    (490, 230, 520, 300),
    # Center left painting
    (370, 230, 400, 300),
    # Center right top painting
    (380, 200, 430, 240),
    # Center left top painting
    (460, 200, 510, 240),
    # Bottom floor window
    (440, 370, 560, 430),
    # Bottom left window
    (220, 370, 340, 430),
    # Bottom right window
    (550, 370, 670, 430),
    # Bottom left mirror
    (0, 280, 110, 500),
    # Bottom right mirror
    (780, 280, 888, 500),
    # Floating top middle window
    (330, 120, 550, 170)
]

draw = ImageDraw.Draw(img)
for b in boxes:
    draw.rectangle(b, outline="red", width=2)

img.save("boxes.png")
