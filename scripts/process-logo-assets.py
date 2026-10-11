import os
import base64
from PIL import Image
import numpy as np

def create_svg_wrapper(png_path, svg_path, width, height):
    with open(png_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    svg = f'''<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <image width="{width}" height="{height}" href="data:image/png;base64,{b64}"/>
</svg>'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg)

def process_assets():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.abspath(os.path.join(script_dir, '..'))
    
    src_path = r'C:\Users\saavi\.gemini\antigravity-ide\brain\2962bfcd-1f35-44ed-a7f4-638087f028ed\.user_uploaded\media_1791709572167.jpg'
    im = Image.open(src_path).convert('RGB')
    arr = np.array(im, dtype=np.float32)

    # 1. Full logo crop
    ymin, ymax = 145, 368
    xmin, xmax = 48, 980
    crop = arr[ymin:ymax, xmin:xmax]
    H, W, _ = crop.shape

    # Calculate distance from white background
    dist_from_white = np.sqrt(np.sum((254.0 - crop)**2, axis=2))
    
    # Calculate smooth alpha
    alpha = np.clip((dist_from_white - 8.0) / 28.0, 0.0, 1.0)
    # Remove gap haze between main logo and subtext
    alpha[170:188, :] = 0.0
    # Clean background dust
    alpha[dist_from_white < 16.0] = 0.0

    # Clean subtext region
    for y in range(188, H):
        for x in range(W):
            d = dist_from_white[y, x]
            if d < 32.0:
                alpha[y, x] = 0.0
            else:
                alpha[y, x] = min(1.0, max(0.0, (d - 22.0) / 40.0))

    # Foreground reconstruction (anti-aliased de-multiplication)
    mask = alpha > 0.01
    fg_light = np.zeros_like(crop)
    for c in range(3):
        fg_light[mask, c] = np.clip((crop[mask, c] - (1.0 - alpha[mask]) * 254.0) / alpha[mask], 0.0, 255.0)

    # Dark mode foreground
    fg_dark = np.copy(fg_light)
    chroma = fg_light.max(axis=2) - fg_light.min(axis=2)
    luminance = 0.299 * fg_light[:, :, 0] + 0.587 * fg_light[:, :, 1] + 0.114 * fg_light[:, :, 2]

    # Main text (1, 8, 0-ring, C, re)
    for y in range(0, 172):
        for x in range(W):
            if mask[y, x] and chroma[y, x] < 45 and luminance[y, x] < 120:
                fg_dark[y, x] = [255, 255, 255]

    # Subtext (DEVELOPER INFRASTRUCTURE)
    for y in range(188, H):
        for x in range(W):
            if mask[y, x] and chroma[y, x] < 45:
                fg_dark[y, x] = [218, 224, 233] # Clean bright silver

    # Build full RGBA images
    rgba_light = np.dstack([fg_light, alpha * 255.0]).astype(np.uint8)
    rgba_dark = np.dstack([fg_dark, alpha * 255.0]).astype(np.uint8)

    img_full_light = Image.fromarray(rgba_light)
    img_full_dark = Image.fromarray(rgba_dark)

    # Compact logos (without subtext, for headers/navbars: y 0..175)
    compact_light = rgba_light[0:175, :]
    compact_dark = rgba_dark[0:175, :]
    img_compact_light = Image.fromarray(compact_light)
    img_compact_dark = Image.fromarray(compact_dark)

    # Clean infinity emblem (blue & purple loops with lock and card)
    # Bounds: y: 46..158, x: 550..742
    inf_crop_light = np.copy(rgba_light[46:158, 550:742])
    inf_crop_dark = np.copy(rgba_dark[46:158, 550:742])
    inf_crop_chroma = inf_crop_light[:, :, :3].max(axis=2) - inf_crop_light[:, :, :3].min(axis=2)
    inf_crop_light[inf_crop_chroma < 35, 3] = 0
    inf_crop_dark[inf_crop_chroma < 35, 3] = 0
    
    # Make a square padded icon from infinity
    ih, iw, _ = inf_crop_light.shape
    size = max(ih, iw) + 24
    sq_inf_light = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sq_inf_dark = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset = ((size - iw) // 2, (size - ih) // 2)
    sq_inf_light.paste(Image.fromarray(inf_crop_light), offset)
    sq_inf_dark.paste(Image.fromarray(inf_crop_dark), offset)

    # Rocket emblem (the circular 0 with rocket)
    # Bounds: y: 0..172, x: 238..418
    rocket_crop_light = rgba_light[0:173, 238:418]
    rocket_crop_dark = rgba_dark[0:173, 238:418]
    
    # Make a square padded icon from rocket 0
    rh, rw, _ = rocket_crop_light.shape
    r_size = max(rh, rw) + 16
    sq_rocket_light = Image.new('RGBA', (r_size, r_size), (0, 0, 0, 0))
    sq_rocket_dark = Image.new('RGBA', (r_size, r_size), (0, 0, 0, 0))
    r_offset = ((r_size - rw) // 2, (r_size - rh) // 2)
    sq_rocket_light.paste(Image.fromarray(rocket_crop_light), r_offset)
    sq_rocket_dark.paste(Image.fromarray(rocket_crop_dark), r_offset)

    # High-resolution (Retina 2x) upscaling
    img_full_light_2x = img_full_light.resize((img_full_light.width * 2, img_full_light.height * 2), Image.Resampling.LANCZOS)
    img_full_dark_2x = img_full_dark.resize((img_full_dark.width * 2, img_full_dark.height * 2), Image.Resampling.LANCZOS)
    img_compact_light_2x = img_compact_light.resize((img_compact_light.width * 2, img_compact_light.height * 2), Image.Resampling.LANCZOS)
    img_compact_dark_2x = img_compact_dark.resize((img_compact_dark.width * 2, img_compact_dark.height * 2), Image.Resampling.LANCZOS)

    # Target directories to save to
    target_dirs = [
        os.path.join(workspace_dir, 'apps', '180developers-frontend', 'public'),
        os.path.join(workspace_dir, 'apps', '180-profile-frontend', 'public'),
        os.path.join(workspace_dir, 'packages', 'ui', 'public'),
    ]

    for td in target_dirs:
        os.makedirs(td, exist_ok=True)
        # Full logos (PNG)
        full_light_png = os.path.join(td, '180-core-logo.png')
        full_dark_png = os.path.join(td, '180-core-logo-dark.png')
        img_full_light_2x.save(full_light_png, optimize=True)
        img_full_dark_2x.save(full_dark_png, optimize=True)

        # Full logos (SVG)
        create_svg_wrapper(full_light_png, os.path.join(td, '180-core-logo.svg'), W, H)
        create_svg_wrapper(full_dark_png, os.path.join(td, '180-core-logo-dark.svg'), W, H)

        # Compact logos (PNG)
        compact_light_png = os.path.join(td, '180-core-logo-compact.png')
        compact_dark_png = os.path.join(td, '180-core-logo-compact-dark.png')
        img_compact_light_2x.save(compact_light_png, optimize=True)
        img_compact_dark_2x.save(compact_dark_png, optimize=True)

        # Compact logos (SVG)
        create_svg_wrapper(compact_light_png, os.path.join(td, '180-core-logo-compact.svg'), W, 175)
        create_svg_wrapper(compact_dark_png, os.path.join(td, '180-core-logo-compact-dark.svg'), W, 175)

        # Infinity icons
        inf_light_png = os.path.join(td, '180-core-infinity-icon.png')
        inf_dark_png = os.path.join(td, '180-core-infinity-icon-dark.png')
        sq_inf_light.save(inf_light_png, optimize=True)
        sq_inf_dark.save(inf_dark_png, optimize=True)
        create_svg_wrapper(inf_light_png, os.path.join(td, '180-core-infinity-icon.svg'), size, size)

        # Rocket icons
        rock_light_png = os.path.join(td, '180-core-icon.png')
        rock_dark_png = os.path.join(td, '180-core-icon-dark.png')
        sq_rocket_light.save(rock_light_png, optimize=True)
        sq_rocket_dark.save(rock_dark_png, optimize=True)

        # Favicons
        sq_rocket_light.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(td, 'favicon-32x32.png'))
        sq_rocket_light.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(td, 'icon-192.png'))
        sq_rocket_light.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(td, 'icon-512.png'))

    print(f'Successfully generated Retina 2x PNG & SVG brand assets into {len(target_dirs)} directories!')

if __name__ == '__main__':
    process_assets()
