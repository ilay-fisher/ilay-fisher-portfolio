#!/usr/bin/env python3
"""
Builds the avatar head-turn frame set from the owner-approved Gemini head-turn video.

  python3 src/sections/About/avatar/generate_frames.py /path/to/avatar-turn.mp4

Needs ffmpeg (set FFMPEG to override /usr/local/bin/ffmpeg), opencv-python, numpy, pillow with WebP.
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
import json, os, subprocess, sys, tempfile
import cv2
import numpy as np

FFMPEG = os.environ.get('FFMPEG', '/usr/local/bin/ffmpeg')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'images', 'avatar', 'turn')
MANIFEST = os.path.join(ROOT, 'src', 'sections', 'About', 'avatar', 'frames.json')
STILL = os.path.join(ROOT, 'public', 'images', 'avatar', 'ilay-avatar.jpg')

CROP_X, CROP = 270, 720          # square around the head in the 1280x720 video
SIZE = 512                       # output frame size
SCALE = 1.0                      # content size relative to the frame (the round lens trims the corners)
N = round(SIZE * SCALE)
OFF_X, OFF_Y = (SIZE - N) // 2, 0
FADE = 0                         # no fade: the round lens hides the video's cut top and bottom edges
TARGET_FRAMES = 64
WEBP_Q = 72
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


def save(path, img):
    cv2.imwrite(path, img, [cv2.IMWRITE_WEBP_QUALITY, WEBP_Q])


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


def main(video):
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    with tempfile.TemporaryDirectory() as tmp:
        get = extract(video, tmp)
        seq = [get(n) for n in range(FIRST, HOLE_A + 1)]
        seq += repair_blink(get)
        seq += [get(n) for n in range(HOLE_B, LAST + 1)]
        still_src = aligned_still(get(0))

    # thin to even head-motion steps
    sm = [small(f) for f in seq]
    arc = np.concatenate([[0], np.cumsum([np.abs(sm[i + 1] - sm[i]).mean() for i in range(len(sm) - 1)])])
    pick = []
    for k in range(TARGET_FRAMES):
        want = arc[-1] * k / (TARGET_FRAMES - 1)
        pick.append(int(np.argmin(np.abs(arc - want))))
    pick = sorted(set(pick))

    names = []
    for k, i in enumerate(pick):
        name = f'f{k:02d}.webp'
        save(os.path.join(OUT, name), compose(seq[i]))
        names.append(name)
    save(os.path.join(OUT, 'still.webp'), compose(still_src))

    # which kept frame looks most like the still (the pose the intro turns away from) and which faces the visitor
    stills = small(still_src)
    start = int(np.argmin([np.abs(sm[i] - stills).mean() for i in pick]))
    with tempfile.TemporaryDirectory() as tmp:
        front = extract_one(video, tmp, 216)
    fs = small(front)
    neutral = int(np.argmin([np.abs(sm[i] - fs).mean() for i in pick]))

    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in names)
    manifest = {
        'dir': '/images/avatar/turn/', 'size': SIZE, 'count': len(names), 'neutral': neutral, 'stillIndex': start,
        'still': 'still.webp', 'frames': names, 'bytes': total,
    }
    with open(MANIFEST, 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')
    print(f'{len(names)} frames, {total / 1000:.0f} kB, neutral={neutral}, stillIndex={start}, source frames used={pick}')


def extract_one(video, tmp, n):
    p = os.path.join(tmp, 'one.png')
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', video, '-vf', f'select=eq(n\\,{n}),crop={CROP}:{CROP}:{CROP_X}:0',
                    '-frames:v', '1', p], check=True)
    return cv2.imread(p)


if __name__ == '__main__':
    main(sys.argv[1])
