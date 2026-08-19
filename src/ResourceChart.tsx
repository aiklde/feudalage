import { useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { ModelResult, Sample, UnitId } from "./model";
import { UNITS, formatClock } from "./model";

const FOOD = "var(--food)";
const WOOD = "var(--wood)";
const GOLD = "var(--gold)";
const SKY = "var(--sky)";
const FOOD_DIM = "var(--food-dim)";
const SKY_DIM = "var(--sky-dim)";
const AXIS = "var(--muted)";
const GRID = "#2a2a2a";
const INK = "var(--ink)";
const FONT = "Archivo, sans-serif";
const LABEL = 9;

export const CHART_W = 900;
export const CHART_PAD_L = 48;
export const CHART_PAD_R = 16;

export function chartPopRange(result: ModelResult): { popMin: number; popMax: number } {
  const xs = result.samples.map((s) => s.xPop);
  const popMin = xs[0] ?? result.samples[0]?.pop ?? 0;
  const popMax = Math.max(popMin + 1, ...xs);
  return { popMin, popMax };
}

function armyHover(counts: Partial<Record<UnitId, number>>): string {
  const parts = (Object.entries(counts) as [UnitId, number][])
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${n} ${UNITS[id].name}${n === 1 ? "" : "s"}`);
  return parts.length ? `  ${parts.join("  ")}` : "";
}

function pathFor(
  samples: Sample[],
  key: keyof Sample,
  x: (pop: number) => number,
  y: (v: number) => number,
): string {
  return samples
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.xPop).toFixed(1)},${y(s[key] as number).toFixed(1)}`)
    .join(" ");
}

function areaFor(
  samples: Sample[],
  key: keyof Sample,
  x: (pop: number) => number,
  y: (v: number) => number,
  zero: number,
): string {
  if (samples.length === 0) return "";
  const line = pathFor(samples, key, x, y);
  const last = samples[samples.length - 1];
  const first = samples[0];
  return `${line} L${x(last.xPop).toFixed(1)},${zero} L${x(first.xPop).toFixed(1)},${zero} Z`;
}

function axisPops(min: number, max: number): number[] {
  const span = max - min;
  const step = span > 20 ? 5 : span > 10 ? 2 : 1;
  const start = Math.ceil(min / step) * step;
  const pops: number[] = [];
  if (min !== start) pops.push(min);
  for (let p = start; p <= max; p += step) pops.push(p);
  if (pops[pops.length - 1] !== max) pops.push(max);
  return pops;
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const inv = ctm.inverse();
  return {
    x: inv.a * clientX + inv.c * clientY + inv.e,
    y: inv.b * clientX + inv.d * clientY + inv.f,
  };
}

type Mark = {
  id: string;
  sample: Sample;
  label: string;
  color: string;
};

type PlacedMark = Mark & {
  ax: number;
  ay: number;
  textX: number;
  textY: number;
  anchor: "start" | "end";
};

function placeMarks(
  marks: Mark[],
  x: (pop: number) => number,
  y: (v: number) => number,
  pad: { l: number; r: number; t: number; b: number },
  W: number,
  H: number,
): PlacedMark[] {
  const placed: PlacedMark[] = marks.map((mark) => {
    const ax = x(mark.sample.xPop);
    const ay = y(mark.sample.wood);
    return {
      ...mark,
      ax,
      ay,
      textX: ax + 8,
      textY: ay - 8,
      anchor: "start",
    };
  });
  placed.sort((a, b) => a.ax - b.ax || a.ay - b.ay);

  const labelWidth = (label: string) => label.length * 5.1;
  const minY = pad.t + 12;
  const maxY = H - pad.b - 4;

  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1];
    const cur = placed[i];
    const closeX = Math.abs(cur.ax - prev.ax) < 130;
    const overlapText =
      closeX &&
      Math.abs(cur.textY - prev.textY) < 18 &&
      cur.textX < prev.textX + labelWidth(prev.label) &&
      prev.textX < cur.textX + labelWidth(cur.label);
    if (!overlapText && !closeX) continue;

    if (Math.abs(cur.ax - prev.ax) < 24) {
      prev.textX = prev.ax - 8;
      prev.anchor = "end";
      prev.textY = Math.max(minY, prev.ay - 10);
      cur.textX = cur.ax + 8;
      cur.anchor = "start";
      cur.textY = Math.min(maxY, cur.ay + 16);
    } else {
      prev.textY = Math.max(minY, prev.ay - 10);
      cur.textY = Math.min(maxY, cur.ay + 16);
    }
  }

  for (const mark of placed) {
    if (mark.anchor === "start" && mark.textX + labelWidth(mark.label) > W - pad.r) {
      mark.textX = mark.ax - 8;
      mark.anchor = "end";
    }
    if (mark.anchor === "end" && mark.textX - labelWidth(mark.label) < pad.l) {
      mark.textX = mark.ax + 8;
      mark.anchor = "start";
    }
    mark.textY = Math.min(maxY, Math.max(minY, mark.textY));
  }

  return placed;
}

export function ResourceChart({
  result,
  gameStartOffset,
  onHover,
  axis,
}: {
  result: ModelResult;
  gameStartOffset: number;
  onHover?: (sample: Sample | null) => void;
  axis?: ReactNode;
}) {
  const [hover, setHover] = useState<{ sample: Sample; x: number } | null>(null);
  const W = CHART_W;
  const H = 280;
  const pad = { l: CHART_PAD_L, r: CHART_PAD_R, t: 18, b: 6 };

  const { x, y, yMax, yMin, popMin, popMax } = useMemo(() => {
    const { popMin, popMax } = chartPopRange(result);
    const peak = Math.max(
      50,
      ...result.samples.flatMap((s) => [s.food, s.wood, s.gold]),
    );
    const trough = Math.min(0, ...result.samples.map((s) => s.wood));
    const yMax = Math.ceil(peak / 100) * 100;
    const yMin = Math.min(0, Math.floor(trough / 100) * 100);
    const span = Math.max(1, yMax - yMin);
    const x = (pop: number) => pad.l + ((pop - popMin) / (popMax - popMin)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - yMin) / span) * (H - pad.t - pad.b);
    return { x, y, yMax, yMin, popMin, popMax };
  }, [result, H, W, pad.l, pad.r, pad.t, pad.b]);

  const zero = y(0);
  const yStep = yMax - yMin > 1000 ? 200 : 100;
  const yTickValues: number[] = [];
  for (let v = yMin; v <= yMax; v += yStep) yTickValues.push(v);
  const viablePop = result.canClickAt === null
    ? undefined
    : result.ticks.find((tick) => tick.t === result.canClickAt)?.pop;
  const horseCollarAfter =
    result.horseCollarAt === null
      ? undefined
      : result.samples.filter((s) => s.t === result.horseCollarAt).at(-1);
  const blacksmithAfter =
    result.blacksmithAt === null
      ? undefined
      : result.samples.filter((s) => s.t === result.blacksmithAt).at(-1);
  const delayedBuildingAt = result.delayedProduction.find((d) => d.paidAt !== null)?.paidAt ?? null;
  const delayedBuilding =
    delayedBuildingAt === null
      ? undefined
      : result.samples.filter((s) => s.t === delayedBuildingAt).at(-1);
  const woodBreak =
    result.woodBrokeAt === null
      ? undefined
      : result.samples.filter((s) => s.t === result.woodBrokeAt).at(-1);

  const marks = useMemo(() => {
    const list: Mark[] = [];
    if (delayedBuilding) {
      list.push({ id: "range", sample: delayedBuilding, label: "2nd building −175w", color: WOOD });
    }
    if (horseCollarAfter) {
      list.push({ id: "collar", sample: horseCollarAfter, label: "Horse Collar −75f −75w", color: WOOD });
    }
    if (blacksmithAfter) {
      list.push({ id: "smith", sample: blacksmithAfter, label: "Blacksmith −150w", color: WOOD });
    }
    if (woodBreak) {
      list.push({ id: "broke", sample: woodBreak, label: "Economy broken", color: FOOD });
    }
    return placeMarks(list, x, y, pad, W, H);
  }, [blacksmithAfter, delayedBuilding, horseCollarAfter, woodBreak, x, y, pad, W, H]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pt = pointerToSvg(e.currentTarget, e.clientX, e.clientY);
    if (!pt || result.samples.length === 0) return;
    const scanX = Math.min(W - pad.r, Math.max(pad.l, pt.x));
    let best = result.samples[0];
    let dist = Infinity;
    for (const s of result.samples) {
      const d = Math.abs(x(s.xPop) - scanX);
      if (d < dist || (d === dist && s.t > best.t)) {
        dist = d;
        best = s;
      }
    }
    setHover({ sample: best, x: scanX });
    onHover?.(best);
  };

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null);
          onHover?.(null);
        }}
      >
        {yTickValues.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={pad.l - 8} y={y(v) + 3} textAnchor="end" fill={AXIS} fontSize={LABEL} fontFamily={FONT} fontWeight="300">
              {v}
            </text>
          </g>
        ))}
        {axisPops(popMin, popMax).map((pop) => (
          <line
            key={`pop-${pop}`}
            x1={x(pop)}
            x2={x(pop)}
            y1={pad.t}
            y2={H - pad.b}
            stroke={GRID}
          />
        ))}
        <path d={areaFor(result.samples, "food", x, y, zero)} fill={FOOD_DIM} />
        {result.ticks.map((tick, i) => {
          if (!tick.viable) return null;
          const endPop = result.ticks[i + 1]?.pop ?? tick.pop + 1;
          const width = Math.max(2, x(endPop) - x(tick.pop));
          return (
            <rect
              key={`viable-${tick.t}`}
              x={x(tick.pop)}
              y={pad.t}
              width={width}
              height={H - pad.t - pad.b}
              fill={SKY_DIM}
            />
          );
        })}
        <path d={pathFor(result.samples, "food", x, y)} fill="none" stroke={FOOD} strokeWidth="2" />
        <path d={pathFor(result.samples, "wood", x, y)} fill="none" stroke={WOOD} strokeWidth="2" />
        <path d={pathFor(result.samples, "gold", x, y)} fill="none" stroke={GOLD} strokeWidth="2" />
        {yMin < 0 && (
          <line x1={pad.l} x2={W - pad.r} y1={zero} y2={zero} stroke={WOOD} strokeDasharray="4 3" strokeOpacity="0.7" />
        )}
        <line x1={pad.l} x2={W - pad.r} y1={y(800)} y2={y(800)} stroke={FOOD} strokeDasharray="3 4" strokeOpacity="0.45" />
        <line x1={pad.l} x2={W - pad.r} y1={y(200)} y2={y(200)} stroke={GOLD} strokeDasharray="3 4" strokeOpacity="0.45" />
        {viablePop !== undefined && (
          <g>
            <line x1={x(viablePop)} x2={x(viablePop)} y1={pad.t} y2={H - pad.b} stroke={SKY} strokeWidth="1.5" />
            <text x={x(viablePop) + 6} y={pad.t + 12} fill={SKY} fontSize={LABEL} fontFamily={FONT} fontWeight="300">
              800f / 200g
            </text>
          </g>
        )}
        {marks.map((mark) => (
          <g key={mark.id}>
            <circle cx={mark.ax} cy={mark.ay} r="3.5" fill={mark.color} />
            <text
              x={mark.textX}
              y={mark.textY}
              textAnchor={mark.anchor}
              fill={mark.color}
              fontSize={LABEL}
              fontFamily={FONT}
              fontWeight="300"
            >
              {mark.label}
            </text>
          </g>
        ))}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={pad.t} y2={H - pad.b} stroke={INK} strokeOpacity="0.35" />
        )}
      </svg>
      {axis}
      <div className="hover-readout">
        {hover
          ? `${hover.sample.pop} vils  ${formatClock(gameStartOffset + hover.sample.t)}  food ${Math.round(hover.sample.food)}  wood ${Math.round(hover.sample.wood)}  gold ${Math.round(hover.sample.gold)}${armyHover(hover.sample.armyCounts)}${hover.sample.castleViable ? "  castle viable" : ""}${hover.sample.wood < 0 ? "  wood broken" : ""}`
          : "Hover the chart for a villager count"}
      </div>
    </div>
  );
}
