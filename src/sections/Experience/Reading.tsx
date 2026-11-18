import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap } from '../../lib/gsap';
import { usePrefersReducedMotion } from '../../lib/motion';
import { countUpValue, formatReading } from './countUp';

/** One bench reading: a number, what it measures, and an optional qualifier. */
export interface ReadingData {
  id: string;
  label: string;
  from: number;
  to: number;
  decimals: number;
  suffix?: string;
  /** Static "before" value shown struck through next to the final one. */
  before?: string;
  note: string;
  /** Full sentence for assistive tech. */
  spoken: string;
}

/**
 * A bench reading. The final value is in the DOM from the start (no JS, reduced motion, tests);
 * with motion allowed it counts up once when scrolled into view. Assistive tech reads `spoken`.
 */
export function Reading({ data }: { data: ReadingData }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const final = formatReading(data.to, data.decimals, data.suffix);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const state = { p: 0 };
      const write = () => {
        el.textContent = formatReading(
          countUpValue(data.from, data.to, state.p, data.decimals),
          data.decimals,
          data.suffix,
        );
      };
      write();
      gsap.to(state, {
        p: 1,
        duration: 1.4,
        ease: 'expo.out',
        onUpdate: write,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <li className="reading">
      <p className="reading__label mono">{data.label}</p>
      <p className="reading__value">
        <span className="visually-hidden">{data.spoken}</span>
        {data.before && (
          <span className="reading__before mono" aria-hidden="true">
            {data.before}
          </span>
        )}
        <span ref={ref} data-count aria-hidden="true">
          {final}
        </span>
      </p>
      <p className="reading__note">{data.note}</p>
    </li>
  );
}
