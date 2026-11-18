# Content — source of truth for site copy

All facts below were gathered from Ilay's LinkedIn profile, safesurfsite.com and the two
project READMEs on 2026-11-18. Do not invent facts, numbers, employers or dates. If a
section needs a fact that is not here, leave it out and note it in your report.

Site language: English only. Voice: first person, plain, specific, no buzzwords, no
exclamation marks. Short sentences. Numbers over adjectives.

## Identity

- Name: Ilay Fisher
- Role line: CS student at Ruppin Academic Center (graduating July 2027). Android, backend, on-device ML.
- Location: Sde Yaakov, Israel
- One-liner (use as the site thesis): "I build software that has to hold up when someone is actively trying to break it."
- Availability: looking for a student or part-time role in Backend, Android or Systems. Available 3 days a week.

## Links (public)

- LinkedIn: https://www.linkedin.com/in/ilay-fisher/
- GitHub: https://github.com/ilay-fisher
- SafeSurf: https://safesurfsite.com
- Email: ilay3002@gmail.com (owner approved public display). Store it in `profile.email` in `src/content/profile.ts`; render as a `mailto:` button.
- Photo: `public/images/ilay.jpg` (800x800 JPEG, already in the repo, owner approved). If it fails to load, show a designed "IF" monogram, never a broken image.
- No phone number anywhere on the site.

## About (long form, edit for layout but keep the facts)

I build software that has to hold up when someone is actively trying to break it.

SafeSurf started as my own problem: every Android filter I tried was either easy to bypass
or too strict to use. So I built one, alone, end to end. It now has paying users.

What I built:

- A GeckoView-based Android browser with global and per-site content rules
- A device-owner enforcement app that blocks bypass at OS level (in-app browsers, WebViews, settings)
- On-device image and text models I trained, running inside the browser without slowing it down
- A React dashboard where a parent or sponsor changes rules in real time
- Firebase backend (Functions, Firestore, Remote Config), PostHog monitoring, scripted releases
- A Chrome and Firefox extension port of the same filter engine

Stack: Kotlin, Java, Jetpack Compose, TypeScript, React, Node, Python, PyTorch, TFLite/ONNX, Firebase, C, C++.

## Experience

1. **Founder & Developer, SafeSurf** — Aug 2025 to present, self-employed
   - Built a GeckoView Android browser and a device-owner companion app that blocks filter bypass at OS level
   - Trained on-device image classifiers; cut the false-block rate in the strict tier from 36.6% to 14.2% while keeping recall
   - Added an on-device semantic text filter and a page-level text x image fusion step
   - Built a React + Firebase dashboard for real-time rule changes, with delayed-unlock and password gates
   - Ported the filter engine to Chrome and Firefox (MV3, declarativeNetRequest)
   - Shipped 22+ releases through a scripted pipeline: build, checksum, upload, Remote Config rollout
   - Ran a 3-month beta, then launched paid subscriptions
2. **Instructor, Magshimim** — Oct 2025 to Oct 2026, part-time
   - Taught and mentored 10 students in advanced C: pointers, memory management, data structures
3. **Technology Instructor, AharayTech (8200 Alumni Association)** — Apr 2024 to Oct 2026
   - Taught Python and web development

## Education

- **Ruppin Academic Center** — B.Sc. Computer Science, 2024 to July 2027, grade average 88
- Courses: C, C#, Java, Python, OOP, data structures, algorithms, computer architecture, big data, machine learning

## Writing

Ilay writes on LinkedIn (1,100+ followers) about how content filtering works on Android.
A six-part series covers: DNS filtering, VPN filtering, filtered browsers, filtered SIMs,
accessibility-service filtering, kosher SIMs. Each post lists what the method catches and
what it misses. Optional small "Writing" strip that links to LinkedIn; no post text copied.

## Projects

### 1. SafeSurf + SafeGuard (flagship, live product)

- URL: https://safesurfsite.com
- What: an Android browser that loads sites without images and video by default, plus a
  device-owner app (SafeGuard) that locks the device around it so the settings hold.
- Key ideas to show:
  - "Block images, not sites." Sites keep working (bank, news, school); images and video
    are not loaded until the user allows them for a site, a page or a single video.
  - "Tighten instantly, loosen after a delay." Adding protection applies at once. Removing
    it waits for a delay the user set earlier (hour, day, week), or a sponsor approves it.
  - SafeGuard hides other browsers, closes in-app browsers, stops new installs and locks
    the system settings that allow bypass (VPN, private DNS).
  - Filtering runs on the device. No VPN, no proxy server.
- Stack: Kotlin, Java, GeckoView, Android device-owner APIs, TFLite, React, Firebase
- Do not show prices.

### 2. Autonomous Drone & Obstacle-Avoidance Sandbox

- Repo: https://github.com/ilay-fisher/drone-obstacle-sandbox
- Live demo: https://ilay-fisher.github.io/drone-obstacle-sandbox/
- What: a browser sandbox where a drone plans and re-plans its route through a city grid in
  real time. Pathfinding engine in C++17 (A* and incremental D* Lite) compiled to
  WebAssembly; React + TypeScript + Canvas renders at 60 FPS; Fastify + PostgreSQL stores
  scenarios and telemetry.
- Key ideas: A* searches from scratch on every replan; D* Lite keeps its values and repairs
  only what changed. 8-connected grid, octile heuristic, no corner cutting, wind zones cost 4x.
- Stack: C++17, Emscripten, WebAssembly, React, TypeScript, Canvas, Fastify, PostgreSQL, Docker
- Local source for reference and screenshot: `/Users/ilayfisher/Documents/proj1` (`docs/screenshot.png`)

### 3. Multi-Modal Visual QA & Anomaly X-Ray Lens

- Repo: https://github.com/ilay-fisher/multimodal-visual-qa-xray-lens
- What: hybrid classical CV + vision-language model inspection. OpenCV finds where
  something changed between a baseline and a target image in about 10 ms; a VLM is asked
  what changed, only on the cropped regions.
- Numbers (from the README benchmark): about 95% fewer image bytes and tokens (2,460 tokens
  full frame vs 117-121 for ROI crops); cloud latency 43.7% lower; Claude Haiku 5.5 got 4/4
  regions right with small-crop upscaling.
- Key idea: deterministic localization, probabilistic interpretation. Do the cheap thing first.
- Stack: Python, OpenCV, FastAPI, Pydantic, SSE, React, TypeScript, Canvas, Docker
- Local source for reference and images: `/Users/ilayfisher/Documents/proj2` (`docs/images/haiku-u2.png`, sample presets under `backend/` or `frontend/`)

## Voice: a little wit (owner approved, 2026-11-18)

The owner wants the page to be a bit witty, sparingly. He rejected jokes about tech stats,
developer in-jokes and anything that makes claims about him. The one line he approved shows
the tone: an invitation to play, one human beat, then the thesis as the payoff.

Approved lines (use exactly):

- Hero invitation: "Throw things at my name. Cheaper than therapy. It holds."

Rules:

- Only lines listed here may be used as wit. Workers do not invent jokes.
- At most one witty line per section, in microcopy (hints, status lines), never in facts.
- Deadpan, short, no exclamation marks, no emoji.
