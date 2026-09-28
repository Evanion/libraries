import type { ComponentProps } from 'react';
import { Stat, StatLine } from '@evanion/baize-ui';

/** One labelled number in a stat line. */
export interface StatFigure {
  label: string;
  value: string;
}

interface FigureLineProps {
  label: string;
  figures: readonly StatFigure[];
  size?: ComponentProps<typeof StatLine>['size'];
}

/** A row of figures, one `Stat` each, under the line's accessible label. */
export function FigureLine({ label, figures, size }: FigureLineProps) {
  return (
    <StatLine label={label} size={size}>
      {figures.map((figure) => (
        <Stat figure={figure.value} key={figure.label} label={figure.label} />
      ))}
    </StatLine>
  );
}
