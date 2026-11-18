// Marks that simple-icons does not carry, taken from the devicon repository (MIT, https://github.com/devicons/devicon)
// and scaled from their 128x128 box into the 24x24 box every other mark uses.
import fs from 'node:fs';

const dir = new URL('./vendor/', import.meta.url);

/** Scales every coordinate of an SVG path by `k` (arc flags and angles are left alone). */
export function scalePath(d, k) {
  const argc = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const num = (v) => String(Math.round(v * k * 1000) / 1000);
  const out = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    const cmd = m[1];
    const n = argc[cmd.toUpperCase()];
    const nums = (m[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? []).map(Number);
    if (n === 0) {
      out.push(cmd);
      continue;
    }
    const parts = [];
    for (let i = 0; i < nums.length; i += n) {
      const seg = nums.slice(i, i + n);
      if (cmd.toUpperCase() === 'A') {
        parts.push(
          [num(seg[0]), num(seg[1]), seg[2], seg[3], seg[4], num(seg[5]), num(seg[6])].join(' '),
        );
      } else parts.push(seg.map(num).join(' '));
    }
    out.push(cmd + parts.join(' '));
  }
  return out.join('').replace(/ -/g, '-');
}

/** Extra marks: slug to title, brand colour, scaled path, source and licence. */
export function vendorMarks() {
  const svg = fs.readFileSync(new URL('devicon-java-plain.svg', dir), 'utf8');
  const d = svg.match(/ d="([^"]+)"/)[1];
  const fill = svg.match(/fill="#([0-9a-fA-F]{6})"/)[1].toUpperCase();
  return {
    java: {
      title: 'Java',
      path: scalePath(d, 24 / 128),
      hex: fill,
      source: 'https://github.com/devicons/devicon/blob/master/icons/java/java-plain.svg',
      guidelines: 'https://www.oracle.com/legal/logos.html',
      licence:
        'MIT (devicon repository, https://github.com/devicons/devicon/blob/master/LICENSE); the Java and the coffee cup mark is a trademark of Oracle',
    },
  };
}
