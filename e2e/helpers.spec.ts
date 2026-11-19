import { expect, test } from '@playwright/test';
import { scrollSettled } from './helpers';

/**
 * `scrollSettled` is what every scroll spec trusts to say "the page has stopped". On a software-GL runner the browser
 * can go a second or more between animation frames while the main thread stays free, so a frame-driven scroller (Lenis)
 * stands still in wall time without being done. The helper has to count frames, not only milliseconds.
 */
test('scrollSettled waits for a scroller that is starved of animation frames, not just for stillness in wall time', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Every animation frame arrives 1.5 s late: the page is responsive but nothing animates in between.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      window.setTimeout(() => raf(cb), 800) as unknown as number;
  });
  await page.goto(
    'data:text/html,' +
      encodeURIComponent('<body style="margin:0"><div style="height:6000px"></div></body>'),
  );
  await page.evaluate(() => {
    window.scrollTo(0, 3000);
    // A frame-driven smooth scroll to the top, the way Lenis does it: a share of the remaining distance per frame.
    const step = () => {
      const y = window.scrollY;
      window.scrollTo(0, y < 100 ? 0 : y * 0.5);
      if (window.scrollY > 0) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const y = await scrollSettled(page, { interval: 150 });
  expect(y, 'it only reports the page settled once the scroll has really arrived').toBeLessThan(2);
});
