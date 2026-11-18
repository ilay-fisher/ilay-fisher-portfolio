#!/usr/bin/env python3
"""
Builds the avatar head-turn frame set (WebP with alpha, so the character stands free on the stage).

  python3 src/sections/About/avatar/generate_frames.py              # picks the best input in _assets/ by itself
  python3 src/sections/About/avatar/generate_frames.py VIDEO [--green] [--green-still IMG] [--range A:B] [--neutral N]

Two input modes:
  legacy (default for avatar-turn.mp4): the owner-approved Gemini head-turn video, dark backdrop, hair cropped at
      the top. A soft organic alpha (head-and-shoulders falloff, dark backdrop keyed out, wide feather) is applied,
      so no rectangle, circle or halo shows against the stage. This is the interim look.
  green (avatar-turn-green.mp4, or any VIDEO with --green): a green-screen head turn. The backdrop is chroma-keyed
      to real alpha (backdrop colour measured from the frame border, edge colour un-mixed from the green, despill,
      light alpha clean-up), every frame is cropped to one common square around the subject, frames are thinned to
      even head-motion steps. --range A:B limits the source frame numbers (e.g. the sweep without a held pose);
      --neutral N pins which kept frame faces the visitor (default: the middle of the sweep).
With no arguments, avatar-turn-green.mp4 in the assets folder wins over avatar-turn.mp4. The assets folder is
$AVATAR_ASSETS, default ../../_assets next to the worktrees (the green-screen still avatar-green.jpg lives there too).

Set AVATAR_OUT / AVATAR_MANIFEST to write somewhere else (used to test without touching the committed frames).

Needs ffmpeg (set FFMPEG to override /usr/local/bin/ffmpeg), opencv-python, numpy and pillow with WebP.
The raw video is not committed. Outputs (committed):
  public/images/avatar/turn/f00.webp ... fNN.webp   512 px frames, index 0 = head turned far to screen right,
                                                    last = far to screen left, monotonic yaw, blink-free
  public/images/avatar/turn/still.webp              the approved still, aligned to the same framing
  src/sections/About/avatar/frames.json             manifest read by the component and its tests

Source timeline (24 fps): frames 48..58 are the held far-right pose, 59..67 contain the blink, 68..104 are the
sweep to far screen left. The blink is repaired in place (open eyes from frames 58 and 68 registered onto the
head of each blink frame), so the head keeps its real motion through the seam and there is no jump. Frames are then thinned to
even steps of head motion (measured as image difference), so equal pointer travel gives equal turn.
"""
import argparse, json, os, subprocess, sys, tempfile
import cv2
import numpy as np
from PIL import Image

FFMPEG = os.environ.get('FFMPEG', '/usr/local/bin/ffmpeg')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
OUT = os.environ.get('AVATAR_OUT', os.path.join(ROOT, 'public', 'images', 'avatar', 'turn'))
MANIFEST = os.environ.get('AVATAR_MANIFEST', os.path.join(ROOT, 'src', 'sections', 'About', 'avatar', 'frames.json'))
ASSETS = os.environ.get('AVATAR_ASSETS', os.path.abspath(os.path.join(ROOT, '..', '..', '_assets')))
STILL = os.path.join(ROOT, 'public', 'images', 'avatar', 'ilay-avatar.jpg')

CROP_X, CROP = 270, 720          # square around the head in the 1280x720 video
SIZE = 512                       # output frame size
SCALE = 1.0                      # content size relative to the frame (the round lens trims the corners)
N = round(SIZE * SCALE)
OFF_X, OFF_Y = (SIZE - N) // 2, 0
FADE = 0                         # no fade: the round lens hides the video's cut top and bottom edges
TARGET_FRAMES = 64
WEBP_Q = 64
FIRST, HOLE_A, HOLE_B, LAST = 48, 58, 68, 104
BG = (22, 17, 12)                # BGR of the video background


def extract(video, tmp):
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', video, '-vf', f'crop={CROP}:{CROP}:{CROP_X}:0',
                    os.path.join(tmp, '%03d.png')], check=True)
    return lambda n: cv2.imread(os.path.join(tmp, f'{n + 1:03d}.png'))


EYES = [((386, 260), (78, 40)), ((578, 263), (44, 38))]   # eye ellipses (centre, radii) in frame 58 coordinates
FEATHER = 9


def ellipse_mask(size=CROP, grow=0, blur=0):
    m = np.zeros((size, size), np.uint8)
    for (cx, cy), (rx, ry) in EYES:
        cv2.ellipse(m, (cx, cy), (rx + grow, ry + grow), 0, 0, 360, 255, -1)
    if blur:
        m = cv2.GaussianBlur(m, (0, 0), blur)
    return m


def step_warp(frm, to, ecc_mask):
    """Affine W with to(x) ~ frm(W x), measured on the skin around the eyes only (the lids change during a blink)."""
    g1 = cv2.GaussianBlur(cv2.cvtColor(to, cv2.COLOR_BGR2GRAY), (0, 0), 2).astype(np.float32)
    g2 = cv2.GaussianBlur(cv2.cvtColor(frm, cv2.COLOR_BGR2GRAY), (0, 0), 2).astype(np.float32)
    w = np.eye(2, 3, dtype=np.float32)
    _, w = cv2.findTransformECC(g1, g2, w, cv2.MOTION_AFFINE,
                                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), ecc_mask, 5)
    return w


def compose_affine(outer, inner):
    """x -> outer(inner(x)) for 2x3 affine matrices."""
    return (np.vstack([outer, [0, 0, 1]]) @ np.vstack([inner, [0, 0, 1]]))[:2].astype(np.float32)


def repair_blink(get):
    """
    Frames 59..67 hold the blink. Their heads are right, only the lids are closed. For each one the open eyes of
    frame 58 and frame 68 are registered onto the head (affine, measured on the surrounding skin, chained frame to
    frame so every step is tiny), taken from whichever is nearer in time, and set into a feathered eye-shaped hole. Every other pixel is
    the original footage, so the head moves smoothly through the seam.
    """
    zone = np.zeros((CROP, CROP), np.uint8)
    zone[150:400, 200:690] = 255
    ecc_mask = cv2.subtract(zone, ellipse_mask(grow=26))
    frames = {n: get(n) for n in range(HOLE_A, HOLE_B + 1)}
    to58 = {HOLE_A: np.eye(2, 3, dtype=np.float32)}
    for n in range(HOLE_A + 1, HOLE_B):
        to58[n] = compose_affine(to58[n - 1], step_warp(frames[n - 1], frames[n], ecc_mask))
    to68 = {HOLE_B: np.eye(2, 3, dtype=np.float32)}
    for n in range(HOLE_B - 1, HOLE_A, -1):
        to68[n] = compose_affine(to68[n + 1], step_warp(frames[n + 1], frames[n], ecc_mask))
    # the eye shapes live in frame 58 space; carry them to each frame through the 58 chain
    shape58 = ellipse_mask(blur=FEATHER).astype(np.float32) / 255
    out = []
    flags = cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP
    for n in range(HOLE_A + 1, HOLE_B):
        t = (n - HOLE_A) / (HOLE_B - HOLE_A)
        a = cv2.warpAffine(frames[HOLE_A], to58[n], (CROP, CROP), flags=flags, borderMode=cv2.BORDER_REPLICATE)
        b = cv2.warpAffine(frames[HOLE_B], to68[n], (CROP, CROP), flags=flags, borderMode=cv2.BORDER_REPLICATE)
        m = cv2.warpAffine(shape58, to58[n], (CROP, CROP), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)[..., None]
        eyes = (a if t < 0.5 else b).astype(np.float32)  # no blend: two gazes cross-faded would show two pupils
        out.append(np.clip(frames[n].astype(np.float32) * (1 - m) + eyes * m, 0, 255).astype(np.uint8))
    return out


def small(img):
    return cv2.GaussianBlur(cv2.cvtColor(cv2.resize(img, (180, 180), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (0, 0), 1).astype(np.float32)


def compose(src):
    """Scale the 720 crop into the 512 canvas (optionally inset, with its cut top and bottom edges faded)."""
    mask = np.ones((CROP, CROP), np.float32)
    if FADE:
        ramp = np.linspace(0, 1, FADE, dtype=np.float32) ** 1.6
        mask[:FADE] = ramp[:, None]
        mask[-FADE:] = ramp[::-1][:, None]
    mask = cv2.resize(mask, (N, N), interpolation=cv2.INTER_AREA)[..., None]
    body = cv2.resize(src, (N, N), interpolation=cv2.INTER_AREA).astype(np.float32)
    canvas = np.zeros((SIZE, SIZE, 3), np.float32) + np.array(BG, np.float32)
    n = N
    region = canvas[OFF_Y:OFF_Y + n, OFF_X:OFF_X + n]
    canvas[OFF_Y:OFF_Y + n, OFF_X:OFF_X + n] = region * (1 - mask) + body * mask
    return np.clip(canvas, 0, 255).astype(np.uint8)


ALPHA_Q = 100                     # lossy alpha: the matte is a soft gradient, so it compresses hard without visible steps


def save(path, img):
    if img.ndim == 3 and img.shape[2] == 4:
        Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)).save(path, 'WEBP', quality=WEBP_Q, alpha_quality=ALPHA_Q, method=5)
    else:
        cv2.imwrite(path, img, [cv2.IMWRITE_WEBP_QUALITY, WEBP_Q])


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def interim_alpha(bgr):
    """
    Legacy footage has a dark backdrop and hair cut off by the top edge, so a true cutout is not possible. Give the
    frame a soft, organic alpha instead. Per frame, the dark backdrop is keyed out by its distance from the measured
    backdrop colour (so backdrop pixels are fully transparent and nothing dark is left to halo against a lighter
    stage), the head's interior is filled solid (so dark eyes and beard are never keyed), and the whole thing is
    multiplied by a loose head-and-shoulders falloff with a long fade over the cut top and a shorter one at the
    cut bottom. Nothing in the result has an edge you can find against the stage, at any yaw.
    """
    h, w = bgr.shape[:2]
    strip = np.concatenate([bgr[100:360, :20].reshape(-1, 3), bgr[100:360, -20:].reshape(-1, 3)])
    backdrop = np.median(strip, axis=0).astype(np.float32)
    diff = np.linalg.norm(cv2.GaussianBlur(bgr, (0, 0), 1.2).astype(np.float32) - backdrop, axis=2)
    key = smoothstep(18, 55, diff)
    fg = (diff > 18).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if n > 1:
        fg = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    inv = (1 - fg).astype(np.uint8)
    ff = inv.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    filled = np.where(ff == 2, 0, 1).astype(np.uint8)                 # everything not reachable from the corner
    inner = cv2.GaussianBlur(cv2.erode(filled, np.ones((11, 11), np.uint8)).astype(np.float32), (0, 0), 3)
    matte = np.maximum(key * cv2.dilate(filled, np.ones((15, 15), np.uint8)).astype(np.float32), inner)
    sil = np.zeros((h, w), np.float32)
    cv2.ellipse(sil, (256, 238), (232, 280), 0, 0, 360, 1, -1)       # head, past the top edge
    cv2.ellipse(sil, (256, 600), (300, 190), 0, 0, 360, 1, -1)       # shoulders, past the bottom edge
    sil = cv2.GaussianBlur(sil, (0, 0), 20)
    y = np.arange(h, dtype=np.float32)[:, None]
    top = smoothstep(0, 105, y)
    bottom = 1 - smoothstep(h - 70, h, y) * 0.55
    # the video's own shadow on the backdrop is dark and bluish (hair, skin and shirt are warm): key it out too
    b_, g_, r_ = [bgr[..., i].astype(np.float32) for i in range(3)]
    cool_dark = (1 - smoothstep(38, 62, np.maximum(np.maximum(b_, g_), r_))) * smoothstep(-6, 2, b_ - r_)
    cool_dark = cv2.GaussianBlur(cool_dark, (0, 0), 1.5)
    alpha = np.clip(matte * (1 - cool_dark) * sil * top * bottom, 0, 1)
    levels = 32                       # few alpha levels keep the lossless alpha small; steps this fine do not show
    alpha = np.round(alpha * levels) / levels
    return np.dstack([bgr, np.round(alpha * 255).astype(np.uint8)])


def flat(bgra, gray=110):
    """BGRA to BGR over mid grey (for measuring motion between frames)."""
    a = bgra[..., 3:4].astype(np.float32) / 255
    return (bgra[..., :3].astype(np.float32) * a + gray * (1 - a)).astype(np.uint8)


def key_green(bgr, backdrop=None):
    """
    Chroma-key a green-screen frame to BGRA. The backdrop colour is measured from the frame border (or passed in), the
    alpha follows how green each pixel is relative to that, the foreground colour is un-mixed from the backdrop
    (so hair edges carry hair colour, not green), then despilled, and the matte gets a light clean-up.
    """
    f = bgr.astype(np.float32)
    if backdrop is None:
        ring = np.concatenate([f[:8].reshape(-1, 3), f[-8:].reshape(-1, 3), f[:, :8].reshape(-1, 3), f[:, -8:].reshape(-1, 3)])
        green = ring[ring[:, 1] - np.maximum(ring[:, 0], ring[:, 2]) > 40]
        backdrop = np.median(green if len(green) > 50 else ring, axis=0)
    bk = np.asarray(backdrop, np.float32)
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    d0 = max(bk[1] - max(bk[0], bk[2]), 1.0)
    greenness = (g - np.maximum(r, b)) / d0
    alpha = 1 - smoothstep(0.14, 0.66, greenness)
    # keep only the main subject: drop stray islands of matte left in the backdrop
    n, lab, stats, _ = cv2.connectedComponentsWithStats((alpha > 0.5).astype(np.uint8), connectivity=8)
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        near = cv2.dilate((lab == keep).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
        alpha = alpha * near
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    a = np.clip(alpha, 0.04, 1)[..., None]
    fg = np.clip((f - (1 - a) * bk) / a, 0, 255)
    limit = 0.5 * (fg[..., 2] + fg[..., 0]) + 4          # despill: green may not exceed the mean of red and blue
    fg[..., 1] = np.minimum(fg[..., 1], limit)
    fg[alpha < 0.02] = 0
    return np.dstack([fg, alpha * 255]).astype(np.uint8)


def subject_box(bgra):
    ys, xs = np.where(bgra[..., 3] > 128)
    return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None


def fit_square(bgra, box, size=SIZE):
    """Crop a square (transparent where it leaves the image) around the subject box, resized to size, premultiplied."""
    x0, y0, x1, y1 = [int(v) for v in box]
    side = int(max(x1 - x0, y1 - y0) * 1.1)
    left = int((x0 + x1) / 2 - side / 2)
    top = int(y1 - side + side * 0.03)                  # the subject's bottom sits on the crop bottom
    h, w = bgra.shape[:2]
    pad = side
    padded = cv2.copyMakeBorder(bgra, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
    crop = padded[top + pad: top + pad + side, left + pad: left + pad + side].astype(np.float32)
    crop[..., :3] *= crop[..., 3:4] / 255               # premultiply so resizing cannot bleed dark into the edge
    small_ = cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)
    al = np.clip(small_[..., 3:4], 1e-3, 255)
    small_[..., :3] = np.clip(small_[..., :3] * 255 / al, 0, 255)
    return np.clip(small_, 0, 255).astype(np.uint8)


def aligned_still(ref0):
    """The approved still is the video's first frame at higher resolution: register it into frame space."""
    still = cv2.imread(STILL)
    s0 = 0.8
    init = np.array([[s0, 0, 216], [0, s0, 224]], np.float32)
    g1 = cv2.GaussianBlur(cv2.cvtColor(ref0, cv2.COLOR_BGR2GRAY), (0, 0), 3).astype(np.float32)
    g2 = cv2.GaussianBlur(cv2.cvtColor(still, cv2.COLOR_BGR2GRAY), (0, 0), 3).astype(np.float32)
    _, w = cv2.findTransformECC(g1, g2, init, cv2.MOTION_AFFINE,
                                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 5)
    return cv2.warpAffine(still, w, (CROP, CROP), flags=cv2.INTER_AREA | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)


def thin(flat_frames, target=TARGET_FRAMES):
    """Indices of the frames at even steps of head motion (measured as image difference)."""
    sm = [small(f) for f in flat_frames]
    arc = np.concatenate([[0], np.cumsum([np.abs(sm[i + 1] - sm[i]).mean() for i in range(len(sm) - 1)])])
    pick = [int(np.argmin(np.abs(arc - arc[-1] * k / (target - 1)))) for k in range(target)]
    return sorted(set(pick)), sm


def write_set(frames, still, neutral, start):
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    names = []
    for k, img in enumerate(frames):
        name = f'f{k:02d}.webp'
        save(os.path.join(OUT, name), img)
        names.append(name)
    save(os.path.join(OUT, 'still.webp'), still)
    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in names)
    manifest = {
        'dir': '/images/avatar/turn/', 'size': SIZE, 'count': len(names), 'neutral': neutral, 'stillIndex': start,
        'still': 'still.webp', 'frames': names, 'bytes': total,
    }
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')
    print(f'{len(names)} frames, {total / 1000:.0f} kB, neutral={neutral}, stillIndex={start}')


def main_legacy(video):
    with tempfile.TemporaryDirectory() as tmp:
        get = extract(video, tmp)
        seq = [get(n) for n in range(FIRST, HOLE_A + 1)]
        seq += repair_blink(get)
        seq += [get(n) for n in range(HOLE_B, LAST + 1)]
        still_src = aligned_still(get(0))
        front = extract_one(video, tmp, 216)
    pick, sm = thin(seq)
    frames = [interim_alpha(compose(seq[i])) for i in pick]
    # which kept frame looks most like the still (the pose the intro turns away from) and which faces the visitor
    stills = small(still_src)
    start = int(np.argmin([np.abs(sm[i] - stills).mean() for i in pick]))
    fs = small(front)
    neutral = int(np.argmin([np.abs(sm[i] - fs).mean() for i in pick]))
    write_set(frames, interim_alpha(compose(still_src)), neutral, start)
    print(f'legacy mode, source frames used={pick}')


def main_green(video, still_path, rng, neutral_pin):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', video, os.path.join(tmp, '%04d.png')], check=True)
        files = sorted(os.listdir(tmp))
        lo, hi = (rng if rng else (1, len(files)))
        keyed = [key_green(cv2.imread(os.path.join(tmp, f))) for f in files[lo - 1: hi]]
    # one crop for every frame, so the head's real motion is the only motion
    boxes = [b for b in (subject_box(k) for k in keyed) if b]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    seq = [fit_square(k, box) for k in keyed]
    pick, sm = thin([flat(f) for f in seq])
    frames = [seq[i] for i in pick]
    neutral = neutral_pin if neutral_pin is not None else len(frames) // 2
    start, still = 0, frames[0]
    if still_path and os.path.exists(still_path):
        # the supplied green still is the first paint when it matches a kept frame well enough (no pop on hand-over)
        cand = fit_square(key_green(cv2.imread(still_path)), box)
        errs = [np.abs(small(flat(cand)) - sm[i]).mean() for i in pick]
        best = int(np.argmin(errs))
        print(f'green still vs nearest kept frame {best}: mean diff {errs[best]:.1f}')
        start = best
        still = cand if errs[best] < 6.0 else frames[best]
    write_set(frames, still, neutral, start)
    print(f'green mode, {len(keyed)} source frames')


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video', nargs='?')
    ap.add_argument('--green', action='store_true', help='treat VIDEO as green-screen footage')
    ap.add_argument('--green-still', default=os.path.join(ASSETS, 'avatar-green.jpg'))
    ap.add_argument('--range', help='source frame range A:B (1-based, green mode)')
    ap.add_argument('--neutral', type=int, help='kept-frame index that faces the visitor (green mode)')
    a = ap.parse_args(argv)
    video, green = a.video, a.green
    if not video:
        g, l = os.path.join(ASSETS, 'avatar-turn-green.mp4'), os.path.join(ASSETS, 'avatar-turn.mp4')
        video, green = (g, True) if os.path.exists(g) else (l, False)
    print(f'input: {video} ({"green screen" if green else "legacy dark backdrop"})')
    if green:
        rng = tuple(int(v) for v in a.range.split(':')) if a.range else None
        main_green(video, a.green_still, rng, a.neutral)
    else:
        main_legacy(video)


def extract_one(video, tmp, n):
    p = os.path.join(tmp, 'one.png')
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', video, '-vf', f'select=eq(n\\,{n}),crop={CROP}:{CROP}:{CROP_X}:0',
                    '-frames:v', '1', p], check=True)
    return cv2.imread(p)


if __name__ == '__main__':
    main(sys.argv[1:])
