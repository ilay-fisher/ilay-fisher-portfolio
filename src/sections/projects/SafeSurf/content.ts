import type { BypassId, PageId } from './rules';

/** One image or video thumbnail in the mock article. */
export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

/** A page of the mock news site. Everything here is invented for the rig. */
export interface MockPage {
  id: PageId;
  path: string;
  headline: string;
  byline: string;
  blocks: ({ type: 'p'; text: string } | { type: 'media'; media: MediaItem })[];
}

const img = (id: string, alt: string, caption: string): MediaItem => ({
  id,
  kind: 'image',
  src: `/images/safesurf/${id}.svg`,
  alt,
  caption,
  width: 640,
  height: 400,
});

const lighthouse = img(
  'lighthouse',
  'A striped lighthouse on a rock at dusk',
  'The light on Hollin Rock, seen from the east mole.',
);
const boats = img(
  'boats',
  'Three small boats tied up in a harbour at dawn',
  'The inner basin an hour before the first departure.',
);
const gauge = img(
  'gauge',
  'A tide gauge post standing in calm water',
  'The gauge at the harbour steps. The marks are read twice a day.',
);
const cliffs = img(
  'cliffs',
  'Layered cliffs in morning mist with gulls',
  'The headland, where the wind first shows itself.',
);
const departure: MediaItem = {
  id: 'departure',
  kind: 'video',
  src: '/images/safesurf/departure.svg',
  alt: 'A fishing boat leaving the harbour at first light',
  caption: 'Video: the 5 a.m. departure, 2 min 10 s.',
  width: 640,
  height: 400,
};

/** The two pages of the mock site: four images and a video, then two images. */
export const PAGES: Record<PageId, MockPage> = {
  harbour: {
    id: 'harbour',
    path: 'tidewatch.example/harbour',
    headline: 'The tide table nobody reads',
    byline: 'Harbour desk, 4 min read',
    blocks: [
      { type: 'media', media: lighthouse },
      {
        type: 'p',
        text: 'Every morning at Hollin Harbour someone climbs the steps, reads a painted gauge and writes one number in a book. The number decides who sails and who waits.',
      },
      { type: 'media', media: boats },
      {
        type: 'p',
        text: 'The book goes back forty years. Nobody has asked to digitise it, because nobody has found a way to make it faster than a person with a pencil and a view of the water.',
      },
      { type: 'media', media: gauge },
      {
        type: 'p',
        text: 'A good reading is boring. A bad one starts a day of phone calls, moved moorings and a long argument about whether the forecast is wrong or the sea is.',
      },
      { type: 'media', media: departure },
      {
        type: 'p',
        text: 'By five the first boat is out. By six the steps are empty again, and the book is back on its shelf.',
      },
      { type: 'media', media: cliffs },
    ],
  },
  weather: {
    id: 'weather',
    path: 'tidewatch.example/wind-at-the-bar',
    headline: 'Wind at the bar, and why it matters',
    byline: 'Weather desk, 2 min read',
    blocks: [
      {
        type: 'p',
        text: 'The bar is the shallow ridge across the harbour mouth. When the wind turns onshore, it is the first place the swell stands up.',
      },
      { type: 'media', media: cliffs },
      {
        type: 'p',
        text: 'Skippers read it from the cliff path before they read any forecast. A white line means wait. A dark line means go.',
      },
      { type: 'media', media: boats },
    ],
  },
};

/** The media on a page, in order. */
export function mediaOf(page: MockPage): MediaItem[] {
  return page.blocks.flatMap((b) => (b.type === 'media' ? [b.media] : []));
}

/** A bypass route the visitor can try, and the specific SafeGuard answer. */
export interface BypassInfo {
  id: BypassId;
  label: string;
  /** Short keycap text. */
  short: string;
  refusal: string;
}

/** The four bypass attempts. The wording follows what SafeGuard really does (docs/CONTENT.md). */
export const BYPASSES: BypassInfo[] = [
  {
    id: 'browser',
    short: 'Browser',
    label: 'Open another browser',
    refusal: 'SafeGuard: other browsers are hidden on this device, so there is nothing to open.',
  },
  {
    id: 'dns',
    short: 'Private DNS',
    label: 'Change private DNS',
    refusal: 'SafeGuard: the private DNS setting is locked by the device owner. Nothing changed.',
  },
  {
    id: 'install',
    short: 'Install app',
    label: 'Install an app',
    refusal: 'SafeGuard: new installs are blocked. Nothing was installed.',
  },
  {
    id: 'inapp',
    short: 'In-app link',
    label: 'Open a link inside another app',
    refusal: 'SafeGuard: in-app browsers are closed. The link would only open in SafeSurf.',
  },
];
