import type { ReadingData } from './Reading';

/**
 * The numbers shown as bench readings. Every figure comes from docs/CONTENT.md
 * (SafeSurf and Magshimim entries); nothing here is estimated.
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
    id: 'beta',
    label: 'Beta before paid launch',
    from: 0,
    to: 3,
    decimals: 0,
    suffix: ' months',
    note: 'Then paid subscriptions.',
    spoken: 'A 3 month beta before launching paid subscriptions',
  },
  {
    id: 'students',
    label: 'Students taught advanced C',
    from: 0,
    to: 10,
    decimals: 0,
    note: 'Pointers, memory management, data structures.',
    spoken: '10 students taught advanced C',
  },
];
