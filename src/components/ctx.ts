import type { AreaPoint, RawData, RawSuburb, SuburbMetrics } from '../lib/data';
import type { Mode, Palette } from '../lib/theme';

/** Everything a dashboard section needs for the current filter state. */
export interface Ctx {
  data: RawData;
  /** Selected quarter index into data.quarters. */
  qi: number;
  /** Selected council, or 'ALL'. */
  council: string;
  /** Minimum trailing-12-month sales for a suburb to appear in rankings. */
  minSales: number;
  palette: Palette;
  mode: Mode;
  /** Suburbs in the selected area. */
  area: RawSuburb[];
  areaName: string;
  areaSeries: AreaPoint[];
  metroSeries: AreaPoint[];
  /** Per-suburb metrics at the selected quarter, for suburbs in the area. */
  metrics: SuburbMetrics[];
  /** Adds a suburb to the explorer and scrolls to it. */
  pick: (suburb: string) => void;
}
