#!/usr/bin/env python3
"""
Builds the avatar's blink assets from real blink footage: one WebP atlas of lid patches plus blinks.json.

It is not run on its own. generate_frames.py calls generate() right after it has built the head-turn frames, because the
blinks must live in exactly the same 512 px frame space (same crop box, same keying) as the turn frames.

How a blink is made (nothing is drawn, everything is cut out of the real footage):
  1. Every blink found in the green clips is a SOURCE: a short run of video frames, open -> closed -> open.
  2. A source is registered onto one frame of the turn set (its ANCHOR, the frame whose head pose it matches) around
     each eye with optical flow, so lids that the head carries along in the video sit exactly where the turn frame's
     lids are. Colour is matched to the anchor from the skin around the eye (a smooth correction field).
  3. Per eye, per source frame, a patch is cut: the footage pixels of the eye socket with a soft matte (feathered
     oval over the area that changes in a blink) whose opacity follows how closed the lid is, so the first and last
     patches are fully transparent and the head frame underneath is left alone: no pop, no shift of the head.
  4. The same is done for the mirror image of every source, registered onto the mirrored anchor on the other side of
     the turn (the footage never turns to screen left). The tone correction is computed against that side's own frame,
     so the lid takes the lighting of the left side of the face instead of carrying the right side's.
  5. Eye tracks: the affine that follows each eye across all turn frames (optical flow chained from the neutral frame).
     At runtime a patch anchored at frame A is drawn at frame i through T_i * T_A^-1, so it follows the eye and
     foreshortens with the turn.

Outputs (committed): public/images/avatar/turn/blinks.webp and src/sections/About/avatar/blinks.json.
The raw clips are not committed. Clip avatar-blinks-green.mp4 is optional: sources that need a missing clip are skipped.
"""
import json, os
import cv2
import numpy as np
from PIL import Image

PW, PH = 84, 56                              # patch size (px, turn-frame space), centred on the eye
ZONE = (31, 17)                              # half axes of the oval in which a blink may change the face
NEUTRAL_EYES = {'E0': (205.0, 221.0), 'E1': (292.0, 221.0)}     # screen-left / screen-right eye in the neutral frame
WEBP_Q, ALPHA_Q = 62, 85
REACH = 10                                   # a set blinks for real up to this many turn frames from its anchor

# id, clip, first open frame, a fully closed frame, last frame (1-based video frames of that clip). Each is a real blink where
# the head is near enough to a turn-set pose to register; blinks filmed at the right profile are out of the kept yaw range.
SOURCES = [
    ('B1', 'b', 5, 9, 13),
    ('C3', 'c', 107, 111, 116),
    ('C4', 'c', 137, 141, 146),
    ('C6', 'c', 205, 209, 214),
    ('A4', 'a', 210, 215, 222),
]
CLIP_FILES = {'a': 'avatar-turn-green-a.mp4', 'b': 'avatar-turn-green-b.mp4', 'c': 'avatar-blinks-green.mp4'}


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def over(bgra, bg=110):
    a = bgra[..., 3:4].astype(np.float32) / 255
    return (bgra[..., :3] * a + bg * (1 - a)).astype(np.uint8)


def gray(bgra):
    return cv2.cvtColor(over(bgra), cv2.COLOR_BGR2GRAY)


def to3(a):
    return np.vstack([a, [0, 0, 1]])


def ring_points(c, w=96, h=60, nx=17, ny=11, hole=(30, 15)):
    xs = np.linspace(c[0] - w / 2, c[0] + w / 2, nx)
    ys = np.linspace(c[1] - h / 2, c[1] + h / 2, ny)
    return np.array([[x, y] for y in ys for x in xs if ((x - c[0]) / hole[0]) ** 2 + ((y - c[1]) / hole[1]) ** 2 > 1], np.float32)


def lk_affine(g0, g1, pts, thr=1.5):
    p1, st, _ = cv2.calcOpticalFlowPyrLK(g0, g1, pts.reshape(-1, 1, 2), None, winSize=(21, 21), maxLevel=4,
                                         criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))
    p1 = p1.reshape(-1, 2)
    ok = st.ravel() == 1
    a, _ = cv2.estimateAffine2D(pts[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=thr)
    return a


def apply(m, pts):
    return (m @ np.vstack([pts.T, np.ones(len(pts))]))[:2].T.astype(np.float32)


def track_eyes(frames, neutral):
    """Affine (neutral frame coords -> frame i coords) for each eye, chained by optical flow outward from the neutral frame."""
    g = [gray(f) for f in frames]
    tracks = {}
    for name, c in NEUTRAL_EYES.items():
        xs, ys = np.linspace(c[0] - 28, c[0] + 28, 11), np.linspace(c[1] - 15, c[1] + 15, 6)
        pts0 = np.array([[x, y] for y in ys for x in xs], np.float32)
        t = [None] * len(frames)
        t[neutral] = np.eye(3)
        for rng in (range(neutral + 1, len(frames)), range(neutral - 1, -1, -1)):
            prev = neutral
            for i in rng:
                a = lk_affine(g[prev], g[i], apply(t[prev][:2], pts0), thr=1.2)
                t[i] = to3(a) @ t[prev]
                prev = i
        tracks[name] = t
    return tracks


def tone_field(main, foot, c, d_mask, valid):
    """Smooth colour correction (BGR) that makes the footage's skin around the eye match the anchor frame's skin."""
    x0, y0 = int(round(c[0] - PW / 2)), int(round(c[1] - PH / 2))
    ring = np.zeros(main.shape[:2], np.float32)
    ring[y0:y0 + PH, x0:x0 + PW] = 1
    ring *= (cv2.dilate(d_mask, np.ones((9, 9), np.uint8)) == 0)
    ring *= valid
    delta = (main - foot) * ring[..., None]
    sig = 7
    # a smooth field where the ring has skin, falling back to the ring's mean shift where it has little (head edge)
    g = delta.sum((0, 1)) / max(float(ring.sum()), 1.0) if ring.sum() > 50 else np.zeros(3, np.float32)
    eps = 0.08
    num = cv2.GaussianBlur(delta, (0, 0), sig) + eps * g
    den = (cv2.GaussianBlur(ring, (0, 0), sig) + eps)[..., None]
    return num / den


def build_eye(anchor_img, anchor_idx, tracks, eye, get, src, flip):
    """Patches of one eye for one source, registered onto the anchor frame. Returns None when the eye is not visible."""
    clip, p0, q, last = src[1:5]
    fetch = (lambda n: np.ascontiguousarray(get(clip, n)[:, ::-1])) if flip else (lambda n: get(clip, n))
    c = (tracks[eye][anchor_idx] @ np.array([*NEUTRAL_EYES[eye], 1.0]))[:2]
    pts = ring_points(c)
    ga = gray(anchor_img)
    g_prev = gray(fetch(p0))
    m = to3(lk_affine(ga, g_prev, pts))
    ms = {p0: m}
    cur = apply(m[:2], pts)
    prev = p0
    for n in range(p0 + 1, last + 1):
        gn = gray(fetch(n))
        a2 = lk_affine(g_prev, gn, cur)
        m = to3(a2) @ ms[prev]
        cur = apply(m[:2], pts)
        ms[n], prev, g_prev = m, n, gn
    warp = lambda n: over(cv2.warpAffine(fetch(n), ms[n][:2], (512, 512), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP,
                                         borderMode=cv2.BORDER_REPLICATE)).astype(np.float32)
    w = {n: warp(n) for n in range(p0, last + 1)}
    wa = cv2.warpAffine(fetch(p0)[..., 3], ms[p0][:2], (512, 512), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    valid = ((wa > 250) & (anchor_img[..., 3] > 250)).astype(np.float32)
    valid = cv2.erode(valid, np.ones((5, 5), np.uint8))
    main = over(anchor_img).astype(np.float32)
    lab = lambda im: cv2.cvtColor(np.clip(im, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    # where a blink changes the face: open vs closed, inside a generous oval
    dl = np.sqrt(((cv2.GaussianBlur(lab(w[q]), (0, 0), 1) - cv2.GaussianBlur(lab(w[p0]), (0, 0), 1)) ** 2).sum(-1))
    zone = np.zeros((512, 512), np.uint8)
    cv2.ellipse(zone, (int(round(c[0])), int(round(c[1]))), ZONE, 0, 0, 360, 1, -1)
    d = ((dl > 7) & (zone > 0)).astype(np.uint8)
    d = cv2.morphologyEx(d, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    k, lbl, st, _ = cv2.connectedComponentsWithStats(d)
    if k < 2:
        return None
    d = (lbl == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    if d.sum() < 380:                               # a sliver of an eye: the far eye at a steep turn
        return None
    d = cv2.dilate(d, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    dsoft = np.clip(cv2.GaussianBlur(d.astype(np.float32), (0, 0), 2.2) * 1.6, 0, 1)
    corr = tone_field(main, w[p0], c, d, valid)
    for n in w:
        w[n] = np.clip(w[n] + corr, 0, 255)
    dm = d > 0
    base_c, base_o = np.abs(w[q] - w[p0]).mean(-1)[dm].mean(), np.abs(w[q] - w[last]).mean(-1)[dm].mean()
    clos = {}
    for n in w:
        if n <= q:
            clos[n] = float(np.clip(np.abs(w[n] - w[p0]).mean(-1)[dm].mean() / max(base_c, 1e-3), 0, 1))
        else:
            clos[n] = float(np.clip(np.abs(w[n] - w[last]).mean(-1)[dm].mean() / max(base_o, 1e-3), 0, 1))
    alpha = {n: dsoft * smooth(0.08, 0.62, clos[n]) for n in w}
    return dict(c=c, w=w, alpha=alpha, clos=clos)


def pick_frames(clos, p0, q, last):
    """Closing run, ONE closed frame, opening run: the real footage holds the lid shut for several frames; the runtime
    sets the hold, so the duplicates would only cost bytes."""
    closing = [n for n in range(p0, q + 1) if n < q and clos[n] < 0.93]
    first_closed = next(n for n in range(p0, q + 1) if clos[n] >= 0.93)
    opening = [n for n in range(q + 1, last + 1) if clos[n] < 0.93]
    return closing + [q], first_closed, opening


def nearest_pose(frames, foot):
    """Turn frame whose head pose is closest to a footage frame (brow, cheek and mouth rows, backdrop-independent)."""
    f = over(foot).astype(np.float32)
    rows = (slice(60, 190), slice(250, 360))
    d = [sum(np.abs(f[r] - over(m).astype(np.float32)[r]).mean() for r in rows) for m in frames]
    return int(np.argmin(d))


def mirror_anchor(frames, ia, lo, hi):
    """Turn frame on the other side of the neutral frame whose pose best matches the mirror image of frame ia."""
    fl = np.ascontiguousarray(frames[ia][:, ::-1])
    g = lambda f: cv2.GaussianBlur(gray(f), (0, 0), 2).astype(np.float32)
    best, bj = -1.0, lo
    for j in range(lo, hi):
        try:
            cc, _ = cv2.findTransformECC(g(frames[j]), g(fl), np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE,
                                         (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-5), None, 5)
        except cv2.error:
            continue
        if cc > best:
            best, bj = cc, j
    return bj


def generate(frames, neutral, get, out_dir, json_path, clips_available, preview=None):
    """frames: the turn frames (BGRA 512). get(clip, n): full-size BGR video frame n (1-based) already registered to clip A."""
    tracks = track_eyes(frames, neutral)
    sets, patches = [], []                       # patches[row] = list of RGBA arrays
    for src in SOURCES:
        sid, clip, p0, q, last = src
        if clip not in clips_available:
            print(f'blink source {sid}: clip {clip} missing, skipped')
            continue
        ia = nearest_pose(frames, get(clip, p0))
        for flip in (False, True):
            anchor = mirror_anchor(frames, ia, neutral + 1, len(frames)) if flip else ia
            eyes = []
            for e in ('E0', 'E1'):
                r = build_eye(frames[anchor], anchor, tracks, e, get, src, flip)
                if r is not None:
                    eyes.append((e, r))
            if not eyes:
                continue
            clos0 = eyes[0][1]['clos']
            closing, first_closed, opening = pick_frames(clos0, p0, q, last)
            order = closing + opening
            seq = closing + opening
            entry = dict(id=sid + ('m' if flip else ''), anchor=anchor, reach=REACH, count=len(seq), closed=len(closing) - 1, eyes=[])
            for e, r in eyes:
                ox, oy = int(round(r['c'][0] - PW / 2)), int(round(r['c'][1] - PH / 2))
                row = []
                for n in seq:
                    rgb = np.clip(r['w'][n], 0, 255)[oy:oy + PH, ox:ox + PW]
                    a = r['alpha'][n][oy:oy + PH, ox:ox + PW]
                    row.append(np.dstack([rgb, a * 255]).astype(np.uint8))
                entry['eyes'].append(dict(eye=0 if e == 'E0' else 1, ox=ox, oy=oy, row=len(patches)))
                patches.append(row)
            sets.append(entry)
            print(f'blink set {entry["id"]}: anchor {anchor}, {entry["count"]} frames, eyes {[x["eye"] for x in entry["eyes"]]}')
    cols = max(len(r) for r in patches)
    atlas = np.zeros((len(patches) * PH, cols * PW, 4), np.uint8)
    for ri, row in enumerate(patches):
        for ci, p in enumerate(row):
            atlas[ri * PH:(ri + 1) * PH, ci * PW:(ci + 1) * PW] = p
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'blinks.webp')
    Image.fromarray(cv2.cvtColor(atlas, cv2.COLOR_BGRA2RGBA)).save(path, 'WEBP', quality=WEBP_Q, alpha_quality=ALPHA_Q, method=6)
    size = os.path.getsize(path)
    out = {
        'atlas': 'blinks.webp', 'bytes': size, 'pw': PW, 'ph': PH, 'neutral': neutral,
        'sets': sets,
        'tracks': {k: [[round(float(v), 3) for v in m[:2].ravel()] for m in t] for k, t in tracks.items()},
    }
    with open(json_path, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(f'blink atlas {atlas.shape[1]}x{atlas.shape[0]}, {size / 1000:.0f} kB, {len(sets)} sets')
    return out, patches, tracks
