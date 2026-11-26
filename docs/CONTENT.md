# Content — source of truth for site copy

All facts below were gathered from Ilay's LinkedIn profile, safesurfsite.com and the two
project READMEs on 2026-11-18. Do not invent facts, numbers, employers or dates. If a
section needs a fact that is not here, leave it out and note it in your report.

**Rewritten for job search from the CVs, 2026-11-19.** The site now aims at student, junior and
entry-level roles (Backend, Android, Systems). The owner's two CVs (`Ilay Fisher Resume.pdf`,
student, and `Ilay Fisher Resume_junior.pdf`, junior) are owner-provided, so every fact in them is
approved. Where they differ, the junior CV's framing leads. The CV phone number is never used.

Site language: English only. Voice: first person, plain, specific, no buzzwords, no
exclamation marks. Short sentences. Numbers over adjectives.

## Identity

- Name: Ilay Fisher
- Headline (hero, `profile.thesis`): "Hi, I'm Ilay. I study computer science and build Android apps, backends and AI agents."
- Role line: "B.Sc. at Ruppin Academic Center, graduating July 2027. For the past year I've built and run SafeSurf and SafeGuard: Kotlin Android apps with a Firebase backend."
- The 50+ active users proof lives in About and the case pages, not in the hero (owner, 2026-11-19).
- Never write "alone", "solo" or "solo-built" (owner, 2026-11-19). Another contributor worked on SafeGuard.
- Availability: Open to a student role or a full-time junior role in Backend, Android or Systems.
  (Student CV and junior CV differ on hours; the owner chose not to state hours. 2026-11-19.)
- Location: Sde Yaakov, Israel
- Page title: "Ilay Fisher — Backend, Android and AI Agents Developer" (owner brief 2026-11-26: the meta must not say "student"; also `og:title`)
- Meta description: "Ilay Fisher: developer seeking a junior Backend, Android, Systems or LLM engineer role. Builds AI agents and runs SafeSurf, a live Android app with 50+ users." (owner brief 2026-11-26, no "student"; `og:description` is the same starting at "Developer", without the name)
- The old thesis "I build software that has to hold up when someone is actively trying to break it." is retired as the headline.

## Links (public)

- LinkedIn: https://www.linkedin.com/in/ilay-fisher/
- GitHub: https://github.com/ilay-fisher
- SafeSurf: https://safesurfsite.com
- Email: ilay3002@gmail.com (owner approved public display). Store it in `profile.email` in `src/content/profile.ts`; render as a `mailto:` button.
- Photo: `public/images/ilay.jpg` (800x800 JPEG, already in the repo, owner approved). If it fails to load, show a designed "IF" monogram, never a broken image.
- Phone 058-779-3124 approved by the owner for the Contact section, 2026-11-19. Rendered as a key linking `tel:+972587793124`. Not in the hero, nav, meta tags, structured data, README or og tags.
- WhatsApp: https://wa.me/972587793124 (owner approved, 2026-11-19). Key labelled "WhatsApp", accessible name "Message Ilay on WhatsApp", opens in a new tab. Contact section only.

## About

Lead: "SafeSurf and SafeGuard are my own Android product. Live since May 2026, 50+ active users, some on paid subscriptions."
Section title: "Built and run end to end."

SafeSurf started as my own problem: every Android filter I tried was either easy to bypass
or too strict to use. So I built one, end to end. Another contributor worked with me on
SafeGuard, and user feedback shaped the features.

I can start on a Kotlin Android app, a Node or Firebase backend, and the tests and CI around them.

What I built:

- A GeckoView-based Android browser with global and per-site content rules. The Kotlin app is 77.7k lines: MVVM, Jetpack Compose, StateFlow, Room, coroutines
- A device-owner enforcement app that blocks bypass at OS level (in-app browsers, WebViews, settings)
- An on-device image classifier I trained (TFLite): 7.6 ms median inference on arm64, false blocks down from 36.6% to 14.2%. A text model runs next to it
- A React dashboard where a parent or sponsor changes rules in real time
- 60+ Firebase Cloud Functions (Node.js), Firestore sync, Remote Config and PostHog monitoring
- A Chrome and Firefox extension port of the same filter engine (Manifest V3)
- GitHub Actions on every PR merge: build, test, lint, then deploy the website, Cloud Functions and APK releases. JUnit, MockK, Espresso, Maestro and Firestore rules tests

Skills (section heading "Skills"): Kotlin, Java, Jetpack Compose, Coroutines, Room, Node.js, Firebase,
PostgreSQL, SQL, REST APIs, Docker, Python, C, C++, TypeScript, React, Linux, Bash, Git, GitHub Actions,
TFLite, PyTorch, ONNX, Claude API, AI agents, Multi-agent orchestration, Prompt engineering. (CV skills, ordered for Backend, Android, Systems roles; the last five were added by the AI section, owner brief 2026-11-19.)

## AI and agent workflows (AI section, owner brief 2026-11-19)

Section `#ai` sits after Experience, before Contact (moved down 2026-11-19: owner feedback "the ai is too on top"; it is a quiet secondary section). Nav label "AI", last in the nav. The projects are never described as AI projects or as done with AI. Facts confirmed by Ilay on 2026-11-19; he built all of them.
Only number: the 637-line release script. No time-saved claims, user counts or links (no public repo). Source: `src/content/aiWorkflows.ts`.

- Title: "AI and agent workflows" (accent: "agent workflows"). No bench pill, no summary line.
- Three cards (owner scope change 2026-11-19; the separate "Custom skills" and "Content plugin" cards and the summary line were removed, their content folded into card 3).
- Release-manager agent (pill "Release"): "Cuts a SafeSurf and SafeGuard release end to end: version bump, builds and signs both Android APKs, checksums, upload to Firebase Storage and a Remote Config update. It runs on top of a 637-line release script."
- Manager and subagent orchestration (pill "Orchestration"): "A manager agent splits the work into tasks and hands each one to its own subagent. Every subagent works in its own git worktree and branch, runs its own tests and opens a pull request. CI runs checks and end-to-end tests on every PR. The manager reviews the diff, screenshots and CI results, checks a production build, then squash-merges and deploys. This site is built this way."
- Skills, plugins and scheduled tasks (pill "Skills"): "I write my own skills, plugins and scheduled tasks for repeated work. Examples: finding a bug's root cause from live evidence before any code edit, verifying Android changes on an emulator, cutting app releases, scanning job listings, and drafting posts with a writer agent and reviewer agents that argue until they agree."
- Project order is now SafeSurf (CASE-01), X-Ray Lens (CASE-02), Drone (CASE-03). SafeSurf also shows 14.2% (false blocks from the on-device image model, down from 36.6%) and 7.6 ms median on arm64 beside its demo.

## Experience

Section title: "What I have shipped and taught." Readings: false-block rate 36.6% to 14.2%, 22+ releases,
50+ active users, 10 students taught advanced C. Bench label: graduating Jul 2027.

1. **Founder & Developer, SafeSurf & SafeGuard** — Aug 2025 to present, self-employed
   - Shipped 22+ releases of an Android browser and a device-owner app through a scripted pipeline. Live since May 2026 with 50+ active users, some on paid subscriptions
   - Built a serverless backend of 60+ Firebase Cloud Functions (Node.js) with Firestore sync and Remote Config, plus a React dashboard for real-time rule changes
   - Cut the false-block rate of the image classifier from 36.6% to 14.2% in the strict tier with on-device ML (TFLite), keeping recall. Inference runs at 7.6 ms median on arm64
   - Developed a 77.7k-line Kotlin Android app (MVVM) with Jetpack Compose, StateFlow, Room and coroutine-based concurrency
   - Set up CI/CD with GitHub Actions: build, test and lint on every PR merge, with automatic deploys of the website, Cloud Functions and APK releases
   - Wrote unit and UI tests: JUnit, MockK, Espresso and Maestro on Android; Node test runner and Firestore rules tests on the Firebase emulator
   - Ported the filter engine to Chrome and Firefox (Manifest V3, declarativeNetRequest)
   - Worked with another contributor on SafeGuard and shaped features from user feedback. Ran a 3-month beta, then launched paid subscriptions
2. **Instructor, Magshimim Cyber Program** — Oct 2025 to Oct 2026, part-time
   - Instructed 10 students in advanced C: pointers, memory allocation, complexity and linked lists
   - Directed their capstone project, a modular GIF playback engine, and guided the group through file I/O parsing
3. **Technology Instructor, AharayTech (8200 Alumni Association)** — Apr 2024 to Oct 2026
   - Taught Python and web development (scholarship program)
4. **Team Member, Rafael Advanced Defense Systems** — Dec 2023 to Aug 2024 (name and dates only)
   - Rafael: name and dates only, details confidential (owner, 2026-11-19)
5. **Squad Commander, Combat Engineering Corps** — Nov 2019 to Jul 2023, military service

## Education

- **Ruppin Academic Center** — B.Sc. Computer Science, 2024 to July 2027 (expected), grade average 85
- Courses: Operating Systems (Linux), Computer Networks, Algorithms, Data structures, Computer architecture, OOP, Machine learning, Big data. Teamwork in university group projects.

## Writing

Ilay writes on LinkedIn (1,100+ followers) about how content filtering works on Android.
A six-part series covers: DNS filtering, VPN filtering, filtered browsers, filtered SIMs,
accessibility-service filtering, kosher SIMs. Each post lists what the method catches and
what it misses. Optional small "Writing" strip that links to LinkedIn; no post text copied.

## Projects

### 1. SafeSurf + SafeGuard (flagship, live product)

- URL: https://safesurfsite.com
- Status label: "Live since May 2026, 50+ active users"
- What: an Android browser that loads sites without images and video by default, plus a
  device-owner app (SafeGuard) that locks the device around it so the settings hold.
- Key ideas to show:
  - "Block images, not sites." Sites keep working (bank, news, school); images and video
    are not loaded until the user allows them for a site, a page or a single video.
  - "Tighten instantly, loosen after a delay." Adding protection applies at once. Removing
    it waits for a delay the user set earlier (hour, day, week), or a sponsor approves it.
  - SafeGuard hides other browsers, closes in-app browsers, suspends any newly installed app and locks
    the system settings that allow bypass (VPN, private DNS).
  - Filtering runs on the device. No VPN, no proxy server.
- Stack: Kotlin, Java, GeckoView, Android device-owner APIs, TFLite, React, Firebase
- Do not show prices.

### 3. Autonomous Drone & Obstacle-Avoidance Sandbox (order changed 2026-11-19)

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

### 2. Multi-Modal Visual QA & Anomaly X-Ray Lens

- Repo: https://github.com/ilay-fisher/multimodal-visual-qa-xray-lens
- What: hybrid classical CV + vision-language model inspection. OpenCV finds where
  something changed between a baseline and a target image in about 10 ms; a VLM is asked
  what changed, only on the cropped regions.
- Numbers (from the README benchmark and the CVs): about 95% fewer image bytes and tokens (2,460 tokens
  full frame vs 117-121 for ROI crops); cloud latency 43.7% lower (17,838 ms to 10,034 ms); Claude Haiku 5.5 got 4/4
  regions right with small-crop upscaling.
- Key idea: deterministic localization, probabilistic interpretation. Do the cheap thing first.
- Stack: Python, OpenCV, FastAPI, Pydantic, SSE, React, TypeScript, Canvas, Docker
- Local source for reference and images: `/Users/ilayfisher/Documents/proj2` (`docs/images/haiku-u2.png`, sample presets under `backend/` or `frontend/`)

## Voice: a little wit (owner approved, 2026-11-18)

The owner wants the page to be a bit witty, sparingly. He rejected jokes about tech stats,
developer in-jokes and anything that makes claims about him. The one line he approved shows
the tone: an invitation to play, one human beat, then the thesis as the payoff.

Approved lines (use exactly):

- Hero invitation: "Throw everything at me. I'll handle it." (owner changed it on 2026-11-19; it replaces
  "Throw things at my name. Cheaper than therapy. It holds.", which is retired)
- SafeSurf invitation (near the filter switch): "Go ahead, turn it off. Everyone tries. It waits."
- SafeSurf delay lock (shown while an unlock request is waiting): "Want it now? So did I. Come back in an hour."
- Drone invitation: "Get in its way. It won't take it personally. It re-plans."
- Contact: "Throwing things was fun. Hiring me is more useful."
- Footer: "You reached the bottom. Nothing broke. That's the point."

Rejected by the owner, never use: any X-Ray joke about the machine taking 10 ms; "I build things
people try to break. First me. Then users."; jokes about stats, pointers, DNS, DevTools, cookies.

Rules:

- Only lines listed here may be used as wit. Workers do not invent jokes.
- At most one witty line visible at a time per section, in microcopy (hints, status lines), never in facts.
- X-Ray and About carry no wit.
- Deadpan, short, no exclamation marks, no emoji.
