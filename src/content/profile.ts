/** Typed profile content. Source of truth for copy is docs/CONTENT.md. */

/** One entry in the experience list. */
export interface ExperienceItem {
  id: string;
  role: string;
  org: string;
  /** Human-readable period, e.g. "Aug 2025 to present". */
  period: string;
  /** Employment type shown next to the period. */
  kind: string;
  /** One-line summary. */
  summary: string;
  highlights: string[];
}

/** Education entry. */
export interface Education {
  school: string;
  degree: string;
  period: string;
  /** Grade average, 0 to 100. */
  average: number;
  courses: string[];
}

/** The whole profile. */
export interface Profile {
  name: string;
  /** Short role line under the name. */
  role: string;
  location: string;
  /** The site thesis. Used as hero and About lead. */
  thesis: string;
  availability: string;
  email: string;
  /** Path under `public/` to the portrait. */
  photo: string;
  /** Initials for the monogram fallback when the photo fails. */
  initials: string;
  links: { linkedin: string; github: string; safesurf: string };
  about: { paragraphs: string[]; built: string[]; stack: string[] };
  experience: ExperienceItem[];
  education: Education;
  writing: { blurb: string; url: string; topics: string[] };
}

/** Ilay Fisher's profile, transcribed from docs/CONTENT.md. */
export const profile: Profile = {
  name: 'Ilay Fisher',
  role: 'CS student at Ruppin Academic Center (graduating July 2027). Android, backend, on-device ML.',
  location: 'Sde Yaakov, Israel',
  thesis: 'I build software that has to hold up when someone is actively trying to break it.',
  availability:
    'Looking for a student or part-time role in Backend, Android or Systems. Available 3 days a week.',
  email: 'ilay3002@gmail.com',
  photo: '/images/ilay.jpg',
  initials: 'IF',
  links: {
    linkedin: 'https://www.linkedin.com/in/ilay-fisher/',
    github: 'https://github.com/ilay-fisher',
    safesurf: 'https://safesurfsite.com',
  },
  about: {
    paragraphs: [
      'SafeSurf started as my own problem: every Android filter I tried was either easy to bypass or too strict to use. So I built one, alone, end to end. It now has paying users.',
    ],
    built: [
      'A GeckoView-based Android browser with global and per-site content rules',
      'A device-owner enforcement app that blocks bypass at OS level (in-app browsers, WebViews, settings)',
      'On-device image and text models I trained, running inside the browser without slowing it down',
      'A React dashboard where a parent or sponsor changes rules in real time',
      'Firebase backend (Functions, Firestore, Remote Config), PostHog monitoring, scripted releases',
      'A Chrome and Firefox extension port of the same filter engine',
    ],
    stack: [
      'Kotlin',
      'Java',
      'Jetpack Compose',
      'TypeScript',
      'React',
      'Node',
      'Python',
      'PyTorch',
      'TFLite/ONNX',
      'Firebase',
      'C',
      'C++',
    ],
  },
  experience: [
    {
      id: 'safesurf',
      role: 'Founder & Developer',
      org: 'SafeSurf',
      period: 'Aug 2025 to present',
      kind: 'Self-employed',
      summary: 'Solo-built an Android content-filtering browser and the app that locks it in.',
      highlights: [
        'Built a GeckoView Android browser and a device-owner companion app that blocks filter bypass at OS level',
        'Trained on-device image classifiers; cut the false-block rate in the strict tier from 36.6% to 14.2% while keeping recall',
        'Added an on-device semantic text filter and a page-level text x image fusion step',
        'Built a React + Firebase dashboard for real-time rule changes, with delayed-unlock and password gates',
        'Ported the filter engine to Chrome and Firefox (MV3, declarativeNetRequest)',
        'Shipped 22+ releases through a scripted pipeline: build, checksum, upload, Remote Config rollout',
        'Ran a 3-month beta, then launched paid subscriptions',
      ],
    },
    {
      id: 'magshimim',
      role: 'Instructor',
      org: 'Magshimim',
      period: 'Oct 2025 to Oct 2026',
      kind: 'Part-time',
      summary: 'Taught advanced C to 10 students.',
      highlights: [
        'Taught and mentored 10 students in advanced C: pointers, memory management, data structures',
      ],
    },
    {
      id: 'aharaytech',
      role: 'Technology Instructor',
      org: 'AharayTech (8200 Alumni Association)',
      period: 'Apr 2024 to Oct 2026',
      kind: 'Instructor',
      summary: 'Taught Python and web development.',
      highlights: ['Taught Python and web development'],
    },
  ],
  education: {
    school: 'Ruppin Academic Center',
    degree: 'B.Sc. Computer Science',
    period: '2024 to July 2027',
    average: 88,
    courses: [
      'C',
      'C#',
      'Java',
      'Python',
      'OOP',
      'data structures',
      'algorithms',
      'computer architecture',
      'big data',
      'machine learning',
    ],
  },
  writing: {
    blurb:
      'I write on LinkedIn (1,100+ followers) about how content filtering works on Android. A six-part series covers each method and lists what it catches and what it misses.',
    url: 'https://www.linkedin.com/in/ilay-fisher/',
    topics: [
      'DNS filtering',
      'VPN filtering',
      'Filtered browsers',
      'Filtered SIMs',
      'Accessibility-service filtering',
      'Kosher SIMs',
    ],
  },
};
