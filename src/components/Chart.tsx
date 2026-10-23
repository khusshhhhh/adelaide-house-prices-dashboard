import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, MapChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, HeatmapChart, LineChart, MapChart,
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent,
  TooltipComponent, VisualMapComponent, CanvasRenderer,
]);

export { echarts };

type Handlers = Record<string, (params: any) => void>;

export function Chart({ option, height = 320, onEvents, ariaLabel }: {
  option: any;
  height?: number;
  onEvents?: Handlers;
  ariaLabel: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const handlers = useRef<Handlers | undefined>(onEvents);
  handlers.current = onEvents;

  useEffect(() => {
    const chart = echarts.init(el.current!, undefined, { renderer: 'canvas' });
    inst.current = chart;
    for (const ev of ['click', 'mouseover', 'legendselectchanged']) {
      chart.on(ev, (p: any) => handlers.current?.[ev]?.(p));
    }
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); chart.dispose(); };
  }, []);

  useEffect(() => {
    inst.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={el} className="chart" style={{ height }} role="img" aria-label={ariaLabel} />;
}
