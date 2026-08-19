import { useEffect, useMemo, useState } from "react";
import { ResourceChart, CHART_W, CHART_PAD_L, CHART_PAD_R, chartPopRange } from "./ResourceChart";
import {
  GATHER_RATES,
  UNITS,
  DEFAULT_ARMY_COUNT,
  armyCountLabel,
  defaultInput,
  extendAssignment,
  padAssignment,
  castleWindowTicks,
  gameClock,
  unitCostLabel,
  unitHasCount,
  usesBarracks,
  simulate,
  type ArmyLine,
  type Job,
  type ModelInput,
  type Sample,
  type UnitId,
} from "./model";

const JOBS: Job[] = ["food", "wood", "gold"];

function Stepper({
  label,
  value,
  job,
  onChange,
}: {
  label: string;
  value: number;
  job?: Job;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper" data-job={job}>
      <div className="label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Fewer ${label}`}>
          −
        </button>
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [input, setInput] = useState<ModelInput>(defaultInput);
  const [brush, setBrush] = useState<Job>("food");
  const [painting, setPainting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [hoverSample, setHoverSample] = useState<Sample | null>(null);
  const [painted, setPainted] = useState(false);
  const ticks = useMemo(() => castleWindowTicks(input, !painted), [input, painted]);
  const assignment = useMemo(
    () =>
      painted
        ? padAssignment(input.assignment, ticks, "idle")
        : extendAssignment(input.assignment, ticks, input.foodVils),
    [input.assignment, ticks, input.foodVils, painted],
  );
  const result = useMemo(() => simulate({ ...input, ticks, assignment }), [input, ticks, assignment]);
  useEffect(() => {
    setHoverSample(null);
  }, [result]);
  const castleSample = (() => {
    const click = result.canClickAt;
    if (click === null) return result.final;
    return (
      result.samples.find((s) => s.t === click) ??
      [...result.samples].reverse().find((s) => s.t <= click) ??
      result.final
    );
  })();
  const eco = hoverSample ?? castleSample;
  const opening = input.foodVils + input.woodVils + input.goldVils + input.builderVils;
  const { popMin, popMax } = chartPopRange(result);
  const popSpan = Math.max(1, popMax - popMin);
  const delayedPaidAt = result.delayedProduction[0]?.paidAt ?? null;
  const set = (patch: Partial<ModelInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const setLine = (index: number, patch: Partial<ArmyLine>) => {
    setInput((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  };
  const removeLine = (index: number) => {
    setInput((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const paint = (index: number) => {
    setPainted(true);
    setInput((prev) => {
      const next = prev.assignment.slice();
      while (next.length <= index) next.push("idle");
      next[index] = brush;
      return { ...prev, assignment: next };
    });
  };

  return (
    <div className="app">
      <aside className="rail">

        <section className="block">
          <h2>Dark Age Economy</h2>
          <div className="vil-grid">
            <Stepper label="Food" job="food" value={input.foodVils} onChange={(foodVils) => set({ foodVils })} />
            <Stepper label="Wood" job="wood" value={input.woodVils} onChange={(woodVils) => set({ woodVils })} />
            <Stepper label="Gold" job="gold" value={input.goldVils} onChange={(goldVils) => set({ goldVils })} />
            <Stepper label="Builders" job="idle" value={input.builderVils} onChange={(builderVils) => set({ builderVils })} />
          </div>
          <p className="chart-caption" style={{ marginTop: 10 }}>
            {opening} villagers in Dark Age.
          </p>
        </section>

        <section className="block">
          {input.lines.map((line, index) => (
            <div key={index} className="army-line">
            <div className="unit-row">
              <label className="field unit-field">
                <span>{index === 0 ? "Unit" : "Second unit"}</span>
                <select
                  value={line.unit}
                  onChange={(e) => {
                    const unit = e.target.value as UnitId;
                    setLine(
                      index,
                      unitHasCount(unit)
                        ? {
                            unit,
                            count: line.count ?? DEFAULT_ARMY_COUNT,
                            buildings: usesBarracks(unit) ? 1 : line.buildings,
                          }
                        : { unit },
                    );
                  }}
                >
                  {Object.values(UNITS).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({unitCostLabel(u)})
                    </option>
                  ))}
                </select>
              </label>
              {!usesBarracks(line.unit) && (
                <div className="field buildings-field">
                  <span>Buildings</span>
                  <div className="buildings-box">
                    <button
                      type="button"
                      onClick={() => setLine(index, { buildings: Math.max(0, line.buildings - 1) })}
                      aria-label="Fewer buildings"
                    >
                      −
                    </button>
                    <strong>{line.buildings}</strong>
                    <button
                      type="button"
                      onClick={() => setLine(index, { buildings: line.buildings + 1 })}
                      aria-label="More buildings"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
              {unitHasCount(line.unit) && (
                <Stepper
                  label={armyCountLabel(line.unit)}
                  value={line.count ?? DEFAULT_ARMY_COUNT}
                  onChange={(count) => setLine(index, { count: Math.max(0, count) })}
                />
              )}
              {index > 0 && (
                <button type="button" className="ghost" onClick={() => removeLine(index)}>
                  Remove second unit
                </button>
              )}
      
            </div>
          ))}
          {input.lines.length < 2 && (
            <button
              type="button"
              className="ghost"
              onClick={() =>
                set({
                  lines: [...input.lines, { unit: "skirmisher", buildings: 1 }],
                })
              }
            >
              Add second unit
            </button>
          )}
        </section>

        <section className="block">
          <h2>Upgrades</h2>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={input.doubleBit} onChange={(e) => set({ doubleBit: e.target.checked })} />
              Double-Bit Axe (100 food, 50 wood)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.horseCollar} onChange={(e) => set({ horseCollar: e.target.checked })} />
              Horse Collar (75 food, 75 wood)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.fletching} onChange={(e) => set({ fletching: e.target.checked })} />
              Fletching (100 food, 50 gold)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.forging} onChange={(e) => set({ forging: e.target.checked })} />
              Forging (150 food)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.paddedArcher} onChange={(e) => set({ paddedArcher: e.target.checked })} />
              Padded Archer Armor (100 food)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.scaleMail} onChange={(e) => set({ scaleMail: e.target.checked })} />
              Scale Mail Armor (100 food)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.scaleBarding} onChange={(e) => set({ scaleBarding: e.target.checked })} />
              Scale Barding Armor (150 food)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.arson} onChange={(e) => set({ arson: e.target.checked })} />
              Arson (75 food, 25 gold)
            </label>
            <label className="check">
              <input type="checkbox" checked={input.bloodlines} onChange={(e) => set({ bloodlines: e.target.checked })} />
              Bloodlines (150 food, 100 gold)
            </label>
          </div>
        </section>

        <button
          type="button"
          className="ghost"
          onClick={() => {
            setInput(defaultInput());
            setPainted(false);
          }}
        >
          Reset to default opener
        </button>
      </aside>

      <main className="stage">
        <header className="hero">
          <div className="clocks">
            <div className="clock">
              <div className="k">Castle Age affordable</div>
              <div className={`v ${result.canClickAt === null ? "warn" : ""}`}>
                {result.canClickAt === null
                  ? "—"
                  : `${gameClock(result.canClickAt, opening)} · ${result.ticks.find((tick) => tick.t === result.canClickAt)?.pop ?? "—"} vils`}
              </div>
            </div>
            <div className="clock">
              <div className="k">Reach Castle Age</div>
              <div className={`v ${result.castleArriveAt === null ? "warn" : ""}`}>
                {result.castleArriveAt === null ? "—" : gameClock(result.castleArriveAt, opening)}
              </div>
            </div>
          </div>
          <div className="stats">
            <div className="stat" data-res="food">
              <div className="k">Food</div>
              <div className="v">{eco.foodVils}</div>
            </div>
            <div className="stat" data-res="wood">
              <div className="k">Wood</div>
              <div className="v">{eco.woodVils}</div>
            </div>
            <div className="stat" data-res="gold">
              <div className="k">Gold</div>
              <div className="v">{eco.goldVils}</div>
            </div>
            {eco.idleVils > 0 && (
              <div className="stat">
                <div className="k">Idle</div>
                <div className="v">{eco.idleVils}</div>
              </div>
            )}
            {input.lines.map((line, index) => (
              <div className="stat" key={`${line.unit}-${index}`}>
                <div className="k">{UNITS[line.unit].name}s</div>
                <div className="v">{eco.armyCounts[line.unit] ?? 0}</div>
              </div>
            ))}
          </div>
        </header>

        {result.delayedProduction.length > 0 && (
          <div className="eco-note" role="status">
            <strong>
              {result.delayedProduction.length === 1
                ? "Second production building will need to be delayed."
                : "Extra production buildings will need to be delayed."}
            </strong>{" "}
            Not enough wood at Feudal for every production building, so the extra{" "}
            {result.delayedProduction.length === 1 ? "one is placed" : "ones are placed"} when 175 wood is free
            {delayedPaidAt !== null ? ` (${gameClock(delayedPaidAt, opening)})` : " — not afforded in this window"}
            .
          </div>
        )}
        {result.woodBrokeAt !== null && (
          <div className="eco-warn" role="alert">
            <strong>Economy is broken.</strong> Wood went negative at{" "}
            {gameClock(result.woodBrokeAt, opening)}
            {result.woodBrokePop !== null ? ` · ${result.woodBrokePop} vils` : ""} paying for{" "}
            {result.woodBrokeReason ?? "a wood spend"}. In game, that spend cannot happen.
          </div>
        )}

        <section className="chart-card">
          <div className="chart-head">
            <h2>Resources</h2>
            <div className="legend">
              <span>
                <i className="swatch" style={{ background: "var(--food)" }} />
                Food
              </span>
              <span>
                <i className="swatch" style={{ background: "var(--wood)" }} />
                Wood
              </span>
              <span>
                <i className="swatch" style={{ background: "var(--gold)" }} />
                Gold
              </span>
              <span>
                <i className="swatch" style={{ background: "var(--sky)" }} />
                Castle Age Affordable
              </span>
            </div>
            <div className="brushes">
              {JOBS.map((job) => (
                <button
                  key={job}
                  type="button"
                  className="brush"
                  data-job={job}
                  data-on={brush === job}
                  onClick={() => setBrush(job)}
                >
                  {job}
                </button>
              ))}
            </div>
          </div>

          <ResourceChart
            result={result}
            gameStartOffset={result.gameStartOffset}
            onHover={setHoverSample}
            axis={
              <div
                className="strip-track"
                style={{
                  paddingLeft: `${(CHART_PAD_L / CHART_W) * 100}%`,
                  paddingRight: `${(CHART_PAD_R / CHART_W) * 100}%`,
                }}
              >
                <div
                  className="strip"
                  onPointerLeave={() => setPainting(false)}
                  onPointerUp={(e) => {
                    setPainting(false);
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  }}
                  onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                >
                  {assignment.map((job, i) => {
                    const tick = result.ticks[i];
                    const left = ((opening + i - popMin) / popSpan) * 100;
                    const width = (1 / popSpan) * 100;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="cell"
                        data-job={job}
                        data-viable={tick?.viable ? "true" : "false"}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setPainting(true);
                          paint(i);
                        }}
                        onPointerEnter={() => {
                          if (painting) paint(i);
                        }}
                      >
                        <span className="n">{opening + i + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            }
          />
        </section>

        <div className="rates">
            <div>
              <span>Food</span>
              <strong>{GATHER_RATES.food.toFixed(2)}/s</strong>
              <em>{(GATHER_RATES.food * 60).toFixed(1)}/min</em>
            </div>
            <div>
              <span>Wood{input.doubleBit ? " · Double-Bit" : ""}</span>
              <strong>{(input.doubleBit ? GATHER_RATES.woodAxe : GATHER_RATES.wood).toFixed(2)}/s</strong>
              <em>
                {(GATHER_RATES.wood * 60).toFixed(1)}/min
                {input.doubleBit ? ` → ${(GATHER_RATES.woodAxe * 60).toFixed(1)}/min after DBA` : ""}
              </em>
            </div>
            <div>
              <span>Gold</span>
              <strong>{GATHER_RATES.gold.toFixed(2)}/s</strong>
              <em>{(GATHER_RATES.gold * 60).toFixed(1)}/min</em>
            </div>
          </div>
        <section className="help">
          <button
            type="button"
            className="help-toggle"
            aria-expanded={helpOpen}
            aria-label="How the model spends wood"
            onClick={() => setHelpOpen((open) => !open)}
          >
            ?
          </button>
          {helpOpen && (
            <div className="help-body">
              <p>
                Each production building is 175 wood at Feudal. Wood enters Feudal 175 lower (barracks already paid), with
                no drop on the chart. Men-at-arms and spearmen train from that barracks and do not need another production
                building. Extra stables or ranges wait until 175 wood is free. Opening food villagers plant 60 wood farms
                gradually from 10:00 so all are on farms by 15:30. If a second production building is declared, the
                blacksmith waits until that building is paid. Blacksmith (150 wood) is built automatically once 150 wood is
                free and a villager is not being sent to food.
              </p>
              <p>
                Each new food villager plants a 60 wood farm. Opening food villagers who are not on farms yet also plant
                gradually from 10:00 through 15:30. The first gold villager builds a 100 wood mining camp if you do not
                already have gold.
                Fletching, Forging, and armor upgrades wait until the blacksmith is up, then research one at a time.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
