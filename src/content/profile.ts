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
  /** The hero headline: a calm introduction. */
  thesis: string;
  availability: string;
  email: string;
  /** Owner-approved (2026-11-19) for the Contact section only. */
  phone: string;
  /** `tel:` link for the phone. */
  phoneHref: string;
  /** WhatsApp chat link. */
  whatsapp: string;
  /** Path under `public/` to the portrait. */
  photo: string;
  /** Initials for the monogram fallback when the photo fails. */
  initials: string;
  links: { linkedin: string; github: string; safesurf: string };
  about: { lead: string; paragraphs: string[]; built: string[]; stack: string[] };
  experience: ExperienceItem[];
  education: Education;
  writing: { blurb: string; url: string; topics: string[] };
}

/** Ilay Fisher's profile, transcribed from docs/CONTENT.md. */
export const profile: Profile = {
  name: 'Ilay Fisher',
  role: "B.Sc. at Ruppin Academic Center, graduating July 2027. For the past year I've built and run SafeSurf and SafeGuard: Kotlin Android apps with a Firebase backend.",
  location: 'Sde Yaakov, Israel',
  thesis: "Hi, I'm Ilay. I study computer science and build Android apps, backends and AI agents.",
  availability: 'Open to a student role or a full-time junior role in Backend, Android or Systems.',
  email: 'ilay3002@gmail.com',
  phone: '058-779-3124',
  phoneHref: 'tel:+972587793124',
  whatsapp: 'https://wa.me/972587793124',
  photo: '/images/ilay.jpg',
  initials: 'IF',
  links: {
    linkedin: 'https://www.linkedin.com/in/ilay-fisher/',
    github: 'https://github.com/ilay-fisher',
    safesurf: 'https://safesurfsite.com',
  },
  about: {
    lead: 'SafeSurf and SafeGuard are my own Android product. Live since May 2026, 50+ active users, some on paid subscriptions.',
    paragraphs: [
      'SafeSurf started as my own problem: every Android filter I tried was either easy to bypass or too strict to use. So I built one, end to end. Another contributor worked with me on SafeGuard, and user feedback shaped the features.',
      'I can start on a Kotlin Android app, a Node or Firebase backend, and the tests and CI around them.',
    ],
    built: [
      'A GeckoView-based Android browser with global and per-site content rules. The Kotlin app is 77.7k lines: MVVM, Jetpack Compose, StateFlow, Room, coroutines',
      'A device-owner enforcement app that blocks bypass at OS level (in-app browsers, WebViews, settings)',
      'An on-device image classifier I trained (TFLite): 7.6 ms median inference on arm64, false blocks down from 36.6% to 14.2%. A text model runs next to it',
      'A React dashboard where a parent or sponsor changes rules in real time',
      '60+ Firebase Cloud Functions (Node.js), Firestore sync, Remote Config and PostHog monitoring',
      'A Chrome and Firefox extension port of the same filter engine (Manifest V3)',
      'GitHub Actions on every PR merge: build, test, lint, then deploy the website, Cloud Functions and APK releases. JUnit, MockK, Espresso, Maestro and Firestore rules tests',
    ],
    stack: [
      'Kotlin',
      'Java',
      'Jetpack Compose',
      'Coroutines',
      'Room',
      'Node.js',
      'Firebase',
      'PostgreSQL',
      'SQL',
      'REST APIs',
      'Docker',
      'Python',
      'C',
      'C++',
      'TypeScript',
      'React',
      'Linux',
      'Bash',
      'Git',
      'GitHub Actions',
      'TFLite',
      'PyTorch',
    ],
  },
  experience: [
    {
      id: 'safesurf',
      role: 'Founder & Developer',
      org: 'SafeSurf & SafeGuard',
      period: 'Aug 2025 to present',
      kind: 'Self-employed',
      summary: 'Built and run an Android content-filtering browser and the app that locks it in.',
      highlights: [
        'Shipped 22+ releases of an Android browser and a device-owner app through a scripted pipeline. Live since May 2026 with 50+ active users, some on paid subscriptions',
        'Built a serverless backend of 60+ Firebase Cloud Functions (Node.js) with Firestore sync and Remote Config, plus a React dashboard for real-time rule changes',
        'Cut the false-block rate of the image classifier from 36.6% to 14.2% in the strict tier with on-device ML (TFLite), keeping recall. Inference runs at 7.6 ms median on arm64',
        'Developed a 77.7k-line Kotlin Android app (MVVM) with Jetpack Compose, StateFlow, Room and coroutine-based concurrency',
        'Set up CI/CD with GitHub Actions: build, test and lint on every PR merge, with automatic deploys of the website, Cloud Functions and APK releases',
        'Wrote unit and UI tests: JUnit, MockK, Espresso and Maestro on Android; Node test runner and Firestore rules tests on the Firebase emulator',
        'Ported the filter engine to Chrome and Firefox (Manifest V3, declarativeNetRequest)',
        'Worked with another contributor on SafeGuard and shaped features from user feedback. Ran a 3-month beta, then launched paid subscriptions',
      ],
    },
    {
      id: 'magshimim',
      role: 'Instructor',
      org: 'Magshimim Cyber Program',
      period: 'Oct 2025 to Oct 2026',
      kind: 'Part-time',
      summary: 'Taught advanced C to 10 students and directed their capstone.',
      highlights: [
        'Instructed 10 students in advanced C: pointers, memory allocation, complexity and linked lists',
        'Directed their capstone project, a modular GIF playback engine, and guided the group through file I/O parsing',
      ],
    },
    {
      id: 'aharaytech',
      role: 'Technology Instructor',
      org: 'AharayTech (8200 Alumni Association)',
      period: 'Apr 2024 to Oct 2026',
      kind: 'Instructor',
      summary: 'Taught Python and web development.',
      highlights: ['Taught Python and web development (scholarship program)'],
    },
    {
      id: 'rafael',
      role: 'Team Member',
      org: 'Rafael Advanced Defense Systems',
      period: 'Dec 2023 to Aug 2024',
      kind: '',
      summary: '',
      highlights: [],
    },
    {
      id: 'service',
      role: 'Squad Commander',
      org: 'Combat Engineering Corps',
      period: 'Nov 2019 to Jul 2023',
      kind: 'Military service',
      summary: 'Squad commander in the Combat Engineering Corps.',
      highlights: ['Military service as a squad commander'],
    },
  ],
  education: {
    school: 'Ruppin Academic Center',
    degree: 'B.Sc. Computer Science',
    period: '2024 to July 2027 (expected)',
    average: 88,
    courses: [
      'Operating Systems (Linux)',
      'Computer Networks',
      'Algorithms',
      'Data structures',
      'Computer architecture',
      'OOP',
      'Machine learning',
      'Big data',
      'Group projects',
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
