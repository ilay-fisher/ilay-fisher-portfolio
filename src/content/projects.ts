/** Typed project content. Source of truth for copy is docs/CONTENT.md. */

/** Stable ids; they double as the section ids on the page. */
export type ProjectId = 'safesurf' | 'drone' | 'xray';

/** An outbound link shown in a project's link row. */
export interface ProjectLink {
  label: string;
  href: string;
}

/** Everything a project section renders, apart from the interactive demo itself. */
export interface Project {
  id: ProjectId;
  title: string;
  /** Bench label: case number, e.g. "CASE-01". */
  caseNo: string;
  /** Bench label: status, e.g. "In production". */
  status: string;
  /** The invitation to the visitor: what to try to break. */
  challenge: string;
  /** One-line summary. */
  summary: string;
  /** Key ideas, short sentences. */
  points: string[];
  stack: string[];
  links: ProjectLink[];
  /** Optional proof numbers shown beside the demo. */
  numbers?: { value: string; label: string }[];
  /** Static screenshot used as the demo fallback. */
  image?: { src: string; alt: string };
}

/** The three projects, in page order. */
export const projects: Project[] = [
  {
    id: 'safesurf',
    title: 'SafeSurf + SafeGuard',
    caseNo: 'CASE-01',
    status: 'Live since May 2026, 50+ active users',
    challenge: 'Try to switch the filter off.',
    summary:
      'An Android browser that loads sites without images and video by default, plus a device-owner app that locks the device around it so the settings hold.',
    points: [
      'Block images, not sites. Sites keep working (bank, news, school); images and video are not loaded until you allow them for a site, a page or a single video.',
      'Tighten instantly, loosen after a delay. Adding protection applies at once. Removing it waits for a delay you set earlier (hour, day, week), or a sponsor approves it.',
      'SafeGuard hides other browsers, closes in-app browsers, stops new installs and locks the system settings that allow bypass (VPN, private DNS).',
      'Filtering runs on the device. No VPN, no proxy server.',
    ],
    stack: [
      'Kotlin',
      'Java',
      'GeckoView',
      'Android device-owner APIs',
      'TFLite',
      'React',
      'Firebase',
    ],
    links: [{ label: 'safesurfsite.com', href: 'https://safesurfsite.com' }],
  },
  {
    id: 'drone',
    title: 'Autonomous Drone & Obstacle-Avoidance Sandbox',
    caseNo: 'CASE-02',
    status: 'Live demo',
    challenge: "Block the drone's route.",
    summary:
      'Solo project. A browser sandbox where a drone plans and re-plans its route through a city grid in real time. The pathfinding engine is C++17 compiled to WebAssembly.',
    points: [
      'A* searches from scratch on every replan. D* Lite keeps its values and repairs only what changed.',
      '8-connected grid, octile heuristic, no corner cutting. Wind zones cost 4x.',
      'React, TypeScript and Canvas render at 60 FPS. Fastify and PostgreSQL store scenarios and telemetry.',
    ],
    stack: [
      'C++17',
      'Emscripten',
      'WebAssembly',
      'React',
      'TypeScript',
      'Canvas',
      'Fastify',
      'PostgreSQL',
      'Docker',
    ],
    links: [
      { label: 'Live demo', href: 'https://ilay-fisher.github.io/drone-obstacle-sandbox/' },
      { label: 'Source', href: 'https://github.com/ilay-fisher/drone-obstacle-sandbox' },
    ],
    image: {
      src: '/images/projects/drone-sandbox.png',
      alt: 'The drone sandbox: a city grid with obstacles and a planned route',
    },
  },
  {
    id: 'xray',
    title: 'Multi-Modal Visual QA & Anomaly X-Ray Lens',
    caseNo: 'CASE-03',
    status: 'Benchmarked',
    challenge: 'Find what changed.',
    summary:
      'Solo project. Hybrid classical CV and vision-language model inspection. OpenCV finds where something changed between a baseline and a target image in about 10 ms; a VLM is asked what changed, only on the cropped regions.',
    points: [
      'Deterministic localization, probabilistic interpretation. Do the cheap thing first.',
      'The model only sees the regions that changed, not the whole frame.',
    ],
    stack: [
      'Python',
      'OpenCV',
      'FastAPI',
      'Pydantic',
      'SSE',
      'React',
      'TypeScript',
      'Canvas',
      'Docker',
    ],
    links: [
      {
        label: 'Source',
        href: 'https://github.com/ilay-fisher/multimodal-visual-qa-xray-lens',
      },
    ],
    numbers: [
      {
        value: '~95%',
        label: 'fewer image bytes and tokens (2,460 tokens full frame vs 117-121 for ROI crops)',
      },
      { value: '43.7%', label: 'lower cloud latency (17,838 ms to 10,034 ms)' },
      { value: '4/4', label: 'regions right with Claude Haiku 5.5 and small-crop upscaling' },
    ],
    image: {
      src: '/images/projects/xray-benchmark.png',
      alt: 'X-Ray Lens benchmark output with flagged regions',
    },
  },
];
