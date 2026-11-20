import type { ReadingData } from './Reading';

/**
 * The numbers shown as bench readings. Every figure comes from docs/CONTENT.md
 * (SafeSurf entry and the two CVs); nothing here is estimated. Teaching is
 * told once, in the timeline, so it has no tile here.
 */
export const READINGS: ReadingData[] = [
  {
    id: 'false-block',
    label: 'False-block rate, strict tier',
    from: 36.6,
    to: 14.2,
    decimals: 1,
    suffix: '%',
    before: '36.6%',
    note: 'On-device image classifiers, recall kept.',
    spoken: 'False-block rate in the strict tier: down from 36.6% to 14.2%',
  },
  {
    id: 'releases',
    label: 'Releases shipped',
    from: 0,
    to: 22,
    decimals: 0,
    suffix: '+',
    note: 'Build, checksum, upload, Remote Config rollout, scripted.',
    spoken: '22+ releases shipped',
  },
  {
    id: 'users',
    label: 'Active users',
    from: 0,
    to: 50,
    decimals: 0,
    suffix: '+',
    note: 'Live since May 2026. Some on paid subscriptions.',
    spoken: '50+ active users since the May 2026 launch, some on paid subscriptions',
  },
];
