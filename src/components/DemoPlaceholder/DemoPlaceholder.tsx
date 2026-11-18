import './DemoPlaceholder.css';

/** Props for {@link DemoPlaceholder}. */
export interface DemoPlaceholderProps {
  /** The `data-testid` the real demo must keep (see docs/CONTRACTS.md). */
  testId: string;
  /** What will live here, in plain words. */
  label: string;
  /** Minimum height in px so the layout is stable. */
  minHeight?: number;
}

/**
 * Marks where an interactive piece will go. Feature workers delete it and render the real
 * demo with the same `data-testid`.
 */
export function DemoPlaceholder({ testId, label, minHeight = 360 }: DemoPlaceholderProps) {
  return (
    <div className="demo-placeholder mono" data-testid={testId} style={{ minHeight }}>
      <span>{label}</span>
      <span className="demo-placeholder__note">Placeholder, demo not built yet</span>
    </div>
  );
}
