/* global URL */
// Marks that simple-icons does not carry, taken from the devicon repository (MIT, https://github.com/devicons/devicon)
// and scaled from their 128x128 box into the 24x24 box every other mark uses.
import fs from 'node:fs';
import * as si from 'simple-icons';

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
  // The C logo is the ISO C++ hexagon with the letter C and without the two plus signs: the hexagon outline
  // and the C counter are the first sub-path, the plus signs are the sub-paths after it.
  const cpp = si.siCplusplus.path;
  const cut = cpp.indexOf('zm', cpp.indexOf('z') + 1);
  return {
    c: {
      title: 'C',
      path: cpp.slice(0, cut + 1),
      hex: '283593',
      source:
        'https://commons.wikimedia.org/wiki/File:C_Programming_Language.svg (the hexagon C mark)',
      guidelines: null,
      licence:
        'Geometry from simple-icons cplusplus (CC0-1.0 data) of the ISO C++ logo, plus signs removed; the Commons file of the same C logo states Public domain; the C logo is unofficial (the language has no brand owner)',
    },
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
