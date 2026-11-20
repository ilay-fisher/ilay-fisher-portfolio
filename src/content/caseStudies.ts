/**
 * Case study copy for the project pages. Every fact comes from docs/CONTENT.md or the two project READMEs it names
 * (sources per fact: docs/reports/project-pages.md). First person, plain, no wit.
 */
import type { ProjectId } from './projects';

/** One real image on a case study page. `src` is under `public/`. */
export interface CaseMedia {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

/** A titled paragraph in the "How it works" section. */
export interface CaseIdea {
  title: string;
  body: string;
}

/** Everything a project page shows beyond what `projects.ts` already holds (title, stack, links, status). */
export interface CaseStudy {
  id: ProjectId;
  /** The page's meta description, 40 to 160 characters. */
  metaDescription: string;
  /** Paragraphs of the problem. */
  problem: string[];
  /** What I built, one item each. */
  built: string[];
  how: CaseIdea[];
  numbers?: { value: string; label: string }[];
  /** Real screenshots. A project without any shows its live rig instead. */
  media?: CaseMedia[];
  /** A caveat shown under the numbers or the stack. */
  note?: string;
}

/** The three case studies, in page order: SafeSurf, X-Ray Lens, Drone. */
export const caseStudies: CaseStudy[] = [
  {
    id: 'safesurf',
    metaDescription:
      'SafeSurf and SafeGuard: a live Android browser and device-owner app. 22+ releases, 50+ active users. Kotlin, Firebase, on-device ML.',
    problem: [
      'Every Android filter I tried was either easy to bypass or too strict to use.',
      'So I built one, end to end. It has been live since May 2026 with 50+ active users, some on paid subscriptions.',
    ],
    built: [
      'A GeckoView-based Android browser with global and per-site content rules.',
      'SafeGuard, a device-owner app that blocks bypass at the OS level: in-app browsers, WebViews and settings.',
      'On-device image and text models that I trained. They run inside the browser without slowing it down.',
      'A React dashboard where a parent or sponsor changes rules in real time, with delayed-unlock and password gates.',
      'A Firebase backend of 60+ Cloud Functions (Node.js) with Firestore and Remote Config, PostHog monitoring and scripted releases.',
      'GitHub Actions that build, test and lint on every PR merge and deploy the website, Cloud Functions and APK releases, with unit and UI tests behind them.',
      'A Chrome and Firefox extension port of the same filter engine.',
    ],
    how: [
      {
        title: 'Block images, not sites.',
        body: 'Sites keep working: bank, news, school. Images and video are not loaded until you allow them for a site, a page or a single video.',
      },
      {
        title: 'Tighten instantly, loosen after a delay.',
        body: 'Adding protection applies at once. Removing it waits for the delay you set earlier (hour, day, week), or until a sponsor approves it.',
      },
      {
        title: 'SafeGuard locks the device around the browser.',
        body: 'It hides other browsers, closes in-app browsers, suspends any newly installed app and locks the system settings that allow bypass, such as VPN and private DNS.',
      },
      {
        title: 'Filtering runs on the device.',
        body: 'No VPN and no proxy server. An on-device text filter and a page-level step that combines text and image results sit next to the image models.',
      },
    ],
    numbers: [
      { value: '50+', label: 'active users since the May 2026 launch, some on paid subscriptions' },
      {
        value: '14.2%',
        label:
          'false blocks from the on-device image model in the strict tier, down from 36.6%, with recall kept. Inference runs at 7.6 ms median on arm64',
      },
      {
        value: '22+',
        label: 'releases through a scripted build, checksum, upload and rollout pipeline',
      },
      { value: '60+', label: 'Firebase Cloud Functions (Node.js)' },
    ],
  },
  {
    id: 'xray',
    metaDescription:
      'X-Ray Lens: Python, OpenCV and FastAPI. Sending only the changed regions to a vision model cut image tokens by about 95%.',
    problem: [
      'Asking a vision model about a whole image is slow and costly, and most of the image has not changed.',
      'I wanted to find what changed between a baseline and a target image, then have a model say what it is.',
    ],
    built: [
      'A computer vision stage with OpenCV that finds where something changed, in about 10 ms.',
      'A FastAPI backend with Pydantic validation that streams the diagnosis over Server-Sent Events.',
      'A pluggable model stage: a free demo rule engine, a local server, or a cloud model.',
      'A React and Canvas lens: a split slides over the target on a knob and a rail, flagged regions lock on with corner brackets, and the diagnosis fills in field by field.',
    ],
    how: [
      {
        title: 'Find where first.',
        body: 'Grayscale and blur, an absolute difference, an adaptive threshold, a morphological close and dilate, then contours become boxes. Overlapping boxes merge and tiny noise is dropped.',
      },
      {
        title: 'Ask what only on the regions.',
        body: 'The browser crops each region and sends one composite: baseline, a gray gap, target. Side by side, the model can compare. A target-only crop cannot show what is missing.',
      },
      {
        title: 'Small crops get upscaled.',
        body: 'A crop with a short side under 75 px is upscaled, up to 4x. Tiny crops starve the model of pixels, so it guesses.',
      },
      {
        title: 'Deterministic localization, probabilistic interpretation.',
        body: 'Do the cheap thing first. The model answers in a structured report that Pydantic validates before it reaches the page.',
      },
    ],
    numbers: [
      {
        value: '~95%',
        label: 'fewer image bytes and tokens (2,460 tokens full frame vs 117-121 for region crops)',
      },
      { value: '43.7%', label: 'lower cloud latency (17,838 ms to 10,034 ms)' },
      { value: '4/4', label: 'regions right with Claude Haiku 5.5 and small-crop upscaling' },
    ],
    media: [
      {
        src: '/images/projects/xray-lens-ui.webp',
        alt: 'The X-Ray Lens on a circuit board: a split lens on a knob shows the CV diff on the left half, two flagged regions have corner brackets, and a diagnosis panel lists category, severity and confidence.',
        caption:
          'The lens in demo mode. The diagnosis is simulated; the latency bars are the measured benchmark.',
        width: 1440,
        height: 900,
      },
      {
        src: '/images/projects/xray-haiku-u2.webp',
        alt: 'A live run with the cloud engine: a solder bridge on a circuit board, with the model diagnosis and an 82 percent confidence figure beside it.',
        caption: 'A live Claude Haiku 5.5 run: a solder bridge found from a 242x75 px composite.',
        width: 1277,
        height: 700,
      },
    ],
    note: 'Locally, cropping barely helps time: latency is dominated by fixed per-call overhead. A 7B local model got 3 of 4 regions right, and Claude Haiku 5.5 got 4 of 4.',
  },
  {
    id: 'drone',
    metaDescription:
      'Drone sandbox: C++17 A* and D* Lite compiled to WebAssembly, replanning a route in real time. React, Fastify and PostgreSQL.',
    problem: [
      'A drone has a route through a city grid. Then an obstacle lands on it.',
      'The planner has to answer again, fast, every time something changes, while the page keeps drawing at 60 FPS.',
    ],
    built: [
      'A pathfinding engine in C++17 with A* and incremental D* Lite, compiled to WebAssembly with Emscripten.',
      'A React, TypeScript and Canvas app that draws the city, the route and the drone at 60 FPS.',
      'A Fastify and PostgreSQL service that stores scenarios and mission telemetry.',
      'The same algorithms in TypeScript, used as a fallback when the Wasm build is missing.',
    ],
    how: [
      {
        title: 'A* starts over.',
        body: 'It searches from scratch on every replan. It is simple, optimal with an admissible heuristic (octile distance) and cheap on small grids. Its cost grows with the whole search area each time an obstacle moves.',
      },
      {
        title: 'D* Lite repairs.',
        body: 'It searches backward from the goal and keeps its values between calls. When a cell changes, only the inconsistent nodes around it are repaired, so a replan after a local change usually expands far fewer nodes. The price is more memory and more complex code, and a new goal resets it.',
      },
      {
        title: 'One grid, one set of rules.',
        body: 'Both planners use an 8-connected grid, the octile heuristic and no corner cutting. Wind zones cost 4x, so the drone takes a longer route when that is cheaper.',
      },
      {
        title: 'The engine and the canvas share memory.',
        body: 'The grid, the visited heat and the path live in WebAssembly memory. The canvas reads them through views, without copying.',
      },
    ],
    numbers: [
      { value: '60 FPS', label: 'canvas render rate' },
      { value: '4x', label: 'cost of a wind zone against open ground' },
    ],
    media: [
      {
        src: '/images/projects/drone-case.webp',
        alt: 'The drone sandbox: a drone flying an orange route between grey buildings, with controls for speed, planner and building tools, and a readout of nodes expanded and path cost.',
        caption: 'The sandbox, mid-flight, with the planner readout below the map.',
        width: 1440,
        height: 900,
      },
    ],
    note: 'The live demo runs in the browser only. It has no backend, so saving and loading scenarios is off there. The full stack runs locally with Docker.',
  },
];

/** The case study for a project. */
export function caseStudyOf(id: ProjectId): CaseStudy {
  const found = caseStudies.find((c) => c.id === id);
  if (!found) throw new Error(`No case study for ${id}`);
  return found;
}
