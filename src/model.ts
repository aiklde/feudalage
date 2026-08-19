export type Job = "food" | "wood" | "gold" | "idle";

export type UnitId = "archer" | "skirmisher" | "scout" | "spearman" | "maa";

export type CivId = "generic" | "persians";

export interface UnitDef {
  id: UnitId;
  name: string;
  food: number;
  wood: number;
  gold: number;
  trainTime: number;
}

export const UNITS: Record<UnitId, UnitDef> = {
  archer: { id: "archer", name: "Archer", food: 0, wood: 25, gold: 45, trainTime: 35 },
  skirmisher: { id: "skirmisher", name: "Skirmisher", food: 25, wood: 35, gold: 0, trainTime: 26 },
  scout: { id: "scout", name: "Scout", food: 80, wood: 0, gold: 0, trainTime: 30 },
  spearman: { id: "spearman", name: "Spearman", food: 35, wood: 25, gold: 0, trainTime: 22 },
  maa: { id: "maa", name: "Man-at-Arms", food: 50, wood: 0, gold: 20, trainTime: 21 },
};

export const MAA_UPGRADE = { food: 100, gold: 40, time: 40, label: "Man-at-Arms upgrade" };

export function unitCostLabel(unit: UnitDef): string {
  const parts = [
    unit.food ? `${unit.food}f` : null,
    unit.wood ? `${unit.wood}w` : null,
    unit.gold ? `${unit.gold}g` : null,
  ].filter(Boolean);
  return `${parts.join(" ")} · ${unit.trainTime}s`;
}

export interface ArmyLine {
  unit: UnitId;
  buildings: number;
  count?: number;
}

export const DEFAULT_ARMY_COUNT = 6;

export function unitHasCount(unit: UnitId): boolean {
  return unit === "scout" || unit === "spearman" || unit === "maa";
}

export function usesBarracks(unit: UnitId): boolean {
  return unit === "maa" || unit === "spearman";
}

export function armyCountLabel(unit: UnitId): string {
  if (unit === "maa") return "Men-at-Arms";
  if (unit === "spearman") return "Spearmen";
  if (unit === "scout") return "Scouts";
  return UNITS[unit].name;
}

export const CIVS: Record<CivId, { name: string; tcWorkRate: number }> = {
  generic: { name: "Generic", tcWorkRate: 1 },
  persians: { name: "Persians", tcWorkRate: 1.1 },
};

export const CASTLE_FOOD = 800;
export const CASTLE_GOLD = 200;
export const CASTLE_RESEARCH = 160;
export const BUILDING_WOOD = 175;
export const BLACKSMITH_WOOD = 150;
export const FARM_WOOD = 60;
export const GOLD_CAMP_WOOD = 100;
const OPENING_FARM_CLOCK = 10 * 60;
const ALL_ON_FARMS_CLOCK = 15 * 60 + 30;

export interface ModelInput {
  civ: CivId;
  foodVils: number;
  woodVils: number;
  goldVils: number;
  builderVils: number;
  foodBank: number;
  woodBank: number;
  goldBank: number;
  assignment: Job[];
  lines: ArmyLine[];
  armyDelay: number;
  doubleBit: boolean;
  fletching: boolean;
  horseCollar: boolean;
  bloodlines: boolean;
  paddedArcher: boolean;
  scaleBarding: boolean;
  forging: boolean;
  scaleMail: boolean;
  arson: boolean;
  ticks: number;
}

export interface Sample {
  t: number;
  food: number;
  wood: number;
  gold: number;
  foodVils: number;
  woodVils: number;
  goldVils: number;
  idleVils: number;
  pop: number;
  armyCounts: Partial<Record<UnitId, number>>;
  castleViable: boolean;
}

export interface Milestone {
  t: number;
  label: string;
  tone: "food" | "wood" | "gold" | "neutral";
}

export interface TickSnapshot {
  index: number;
  t: number;
  pop: number;
  food: number;
  gold: number;
  viable: boolean;
}

export interface ModelResult {
  samples: Sample[];
  ticks: TickSnapshot[];
  milestones: Milestone[];
  canClickAt: number | null;
  castleArriveAt: number | null;
  blacksmithAt: number | null;
  final: Sample;
  armyProduced: Partial<Record<UnitId, number>>;
  buildingWood: number;
  vilsProduced: number;
  starvedTicks: number;
  gameStartOffset: number;
  woodBrokeAt: number | null;
  woodBrokePop: number | null;
  woodBrokeReason: string | null;
  delayedProduction: { paidAt: number | null }[];
}

const FEUDAL_RESEARCH = 130;
const VIL_FOOD = 50;
const VIL_TRAIN = 25;
const HOUSE_WOOD = 25;
const HOUSE_POP = 5;
const ARMY_DELAY = 50;

export const GATHER_RATES = {
  food: 0.33,
  wood: 0.38,
  woodAxe: 28.1 / 60,
  gold: 0.39,
};

type TechKey =
  | "axe"
  | "fletching"
  | "horseCollar"
  | "bloodlines"
  | "paddedArcher"
  | "scaleBarding"
  | "forging"
  | "scaleMail"
  | "arson"
  | "maa";

interface Tech {
  key: TechKey;
  enabled: boolean;
  food: number;
  wood: number;
  gold: number;
  time: number;
  label: string;
  tone: Milestone["tone"];
  requiresBlacksmith: boolean;
  done: boolean;
  researching: boolean;
  progress: number;
}

function housingFor(pop: number): number {
  return Math.ceil(Math.max(pop, 1) / HOUSE_POP) * HOUSE_POP;
}

const FOOD_UNTIL = 17;
const MAX_NEW_VILS = 40;
const CASTLE_EXTRA_VILS = 2;

export function defaultAssignment(length = 24, openingFood = 9): Job[] {
  return extendAssignment([], length, openingFood);
}

export function extendAssignment(assignment: Job[], length: number, openingFood: number): Job[] {
  const next = assignment.slice(0, length);
  while (next.length < length) {
    const food = openingFood + next.filter((job) => job === "food").length;
    next.push(food < FOOD_UNTIL ? "food" : "gold");
  }
  return next;
}

export function padAssignment(assignment: Job[], length: number, fill: Job = "idle"): Job[] {
  const next = assignment.slice(0, length);
  while (next.length < length) next.push(fill);
  return next;
}

export function defaultInput(): ModelInput {
  return {
    civ: "generic",
    foodVils: 9,
    woodVils: 10,
    goldVils: 0,
    builderVils: 0,
    foodBank: 0,
    woodBank: 0,
    goldBank: 0,
    assignment: defaultAssignment(),
    lines: [{ unit: "scout", buildings: 1, count: DEFAULT_ARMY_COUNT }],
    armyDelay: 50,
    doubleBit: true,
    fletching: false,
    horseCollar: true,
    bloodlines: false,
    paddedArcher: false,
    scaleBarding: false,
    forging: false,
    scaleMail: false,
    arson: false,
    ticks: 24,
  };
}

export function gameClock(secondsFromFeudalClick: number, openingVils: number): string {
  const darkAge = Math.max(0, openingVils - 2) * VIL_TRAIN;
  return formatClock(darkAge + secondsFromFeudalClick);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function isPeriod(t: number, start: number, period: number): boolean {
  if (t <= start) return false;
  const n = Math.round((t - start) / period);
  if (n < 1) return false;
  return Math.abs(t - (start + n * period)) < 0.5;
}

export function simulate(input: ModelInput): ModelResult {
  const tcRate = CIVS[input.civ].tcWorkRate;
  const vilTime = VIL_TRAIN / tcRate;
  const periodStart = FEUDAL_RESEARCH;
  const lines = input.lines.filter((line) => line.buildings > 0);
  const needsMaa = lines.some((line) => line.unit === "maa");
  const scoutIntoArchers =
    lines.some((line) => line.unit === "scout") && lines.some((line) => line.unit === "archer");

  let food = input.foodBank;
  let wood = input.woodBank - BUILDING_WOOD;
  let gold = input.goldBank;
  let foodVils = input.foodVils;
  let woodVils = input.woodVils;
  let goldVils = input.goldVils;
  let idleVils = input.builderVils;
  let pop = foodVils + woodVils + goldVils + idleVils;
  let housing = housingFor(pop);
  let goldCampPaid = goldVils > 0;

  let vilProgress = 0;
  let producingVil = false;
  let assignmentIndex = 0;
  let vilsProduced = 0;

  const techs: Tech[] = [
    { key: "axe", enabled: input.doubleBit, food: 100, wood: 50, gold: 0, time: 25, label: "Double-Bit Axe", tone: "wood", requiresBlacksmith: false, done: false, researching: false, progress: 0 },
    { key: "horseCollar", enabled: input.horseCollar, food: 75, wood: 75, gold: 0, time: 40, label: "Horse Collar", tone: "food", requiresBlacksmith: false, done: false, researching: false, progress: 0 },
    { key: "fletching", enabled: input.fletching, food: 100, wood: 0, gold: 50, time: 30, label: "Fletching", tone: "gold", requiresBlacksmith: true, done: false, researching: false, progress: 0 },
    { key: "forging", enabled: input.forging, food: 150, wood: 0, gold: 0, time: 50, label: "Forging", tone: "food", requiresBlacksmith: true, done: false, researching: false, progress: 0 },
    { key: "paddedArcher", enabled: input.paddedArcher, food: 100, wood: 0, gold: 0, time: 40, label: "Padded Archer Armor", tone: "food", requiresBlacksmith: true, done: false, researching: false, progress: 0 },
    { key: "scaleMail", enabled: input.scaleMail, food: 100, wood: 0, gold: 0, time: 45, label: "Scale Mail Armor", tone: "food", requiresBlacksmith: true, done: false, researching: false, progress: 0 },
    { key: "scaleBarding", enabled: input.scaleBarding, food: 150, wood: 0, gold: 0, time: 50, label: "Scale Barding Armor", tone: "food", requiresBlacksmith: true, done: false, researching: false, progress: 0 },
    { key: "bloodlines", enabled: input.bloodlines, food: 150, wood: 0, gold: 100, time: 50, label: "Bloodlines", tone: "gold", requiresBlacksmith: false, done: false, researching: false, progress: 0 },
    { key: "arson", enabled: input.arson, food: 75, wood: 0, gold: 25, time: 25, label: "Arson", tone: "food", requiresBlacksmith: false, done: false, researching: false, progress: 0 },
    { key: "maa", enabled: needsMaa, food: MAA_UPGRADE.food, wood: 0, gold: MAA_UPGRADE.gold, time: MAA_UPGRADE.time, label: MAA_UPGRADE.label, tone: "food", requiresBlacksmith: false, done: false, researching: false, progress: 0 },
  ];

  const producers: {
    unit: UnitId;
    remaining: number;
    queued: boolean;
    paid: boolean;
    needsBuilding: boolean;
    target: number;
  }[] = [];
  let freeBarracks = 1;
  for (const line of lines) {
    for (let i = 0; i < line.buildings; i++) {
      const needsBuilding = !(usesBarracks(line.unit) && freeBarracks > 0);
      if (!needsBuilding) freeBarracks -= 1;
      producers.push({
        unit: line.unit,
        remaining: 0,
        queued: false,
        paid: !needsBuilding,
        needsBuilding,
        target: unitHasCount(line.unit) ? Math.max(0, line.count ?? DEFAULT_ARMY_COUNT) : Infinity,
      });
    }
  }
  const buildingWood = BUILDING_WOOD * producers.filter((p) => p.needsBuilding).length;
  const armyCounts: Partial<Record<UnitId, number>> = {};
  const delayedProduction: { paidAt: number | null }[] = [];

  let canClickAt: number | null = null;
  let blacksmithAt: number | null = null;
  let woodBrokeAt: number | null = null;
  let woodBrokePop: number | null = null;
  let woodBrokeReason: string | null = null;
  let castleViable = false;
  let starvedTicks = 0;
  let buildingsPaid = false;
  let blacksmithPaid = false;
  let openingFarmsPaid = 0;
  const openingFarmCount = foodVils;
  let pendingFarms = 0;
  const gameStartOffset = Math.max(0, pop - 2) * VIL_TRAIN;
  const openingFarmStart = Math.max(0, OPENING_FARM_CLOCK - gameStartOffset);
  const openingFarmEnd = Math.max(openingFarmStart, ALL_ON_FARMS_CLOCK - gameStartOffset);
  const openingFarmInterval =
    openingFarmCount <= 1 ? 0 : (openingFarmEnd - openingFarmStart) / (openingFarmCount - 1);
  const openingFarmsDueAt = (t: number) => {
    if (openingFarmCount <= 0 || t < openingFarmStart) return 0;
    if (openingFarmCount === 1 || t >= openingFarmEnd) return openingFarmCount;
    return Math.min(openingFarmCount, Math.floor((t - openingFarmStart) / openingFarmInterval) + 1);
  };

  const samples: Sample[] = [];
  const tickSnapshots: TickSnapshot[] = [];
  const milestones: Milestone[] = [
    { t: 0, label: "Feudal click", tone: "neutral" },
    { t: FEUDAL_RESEARCH, label: "Feudal arrives", tone: "neutral" },
  ];

  const duration = FEUDAL_RESEARCH + input.ticks * VIL_TRAIN + 1;

  const snapshot = (t: number): Sample => ({
    t,
    food,
    wood,
    gold,
    foodVils,
    woodVils,
    goldVils,
    idleVils,
    pop,
    armyCounts: { ...armyCounts },
    castleViable,
  });

  const noteWoodBreak = (at: number, reason: string) => {
    if (wood >= -0.5 || woodBrokeAt !== null) return;
    woodBrokeAt = at;
    woodBrokePop = pop;
    woodBrokeReason = reason;
    samples.push(snapshot(at));
    milestones.push({ t: at, label: `Wood economy broken (${reason})`, tone: "food" });
  };

  const spendWood = (amount: number, at: number, reason: string) => {
    if (wood - amount < -0.5 && woodBrokeAt === null) samples.push(snapshot(at));
    wood -= amount;
    noteWoodBreak(at, reason);
  };

  const assign = (job: Job, at: number) => {
    if (job === "food") {
      foodVils += 1;
      if (wood >= FARM_WOOD) {
        samples.push(snapshot(at));
        wood -= FARM_WOOD;
        samples.push(snapshot(at));
      } else {
        pendingFarms += 1;
      }
    } else if (job === "wood") {
      woodVils += 1;
    } else if (job === "gold") {
      if (!goldCampPaid) {
        spendWood(GOLD_CAMP_WOOD, at, "a mining camp");
        goldCampPaid = true;
        milestones.push({ t: at, label: "Mining camp (100w)", tone: "wood" });
      }
      goldVils += 1;
    } else {
      idleVils += 1;
    }
  };

  const armyHeadcount = () => {
    let n = 0;
    for (const count of Object.values(armyCounts)) n += count ?? 0;
    for (const p of producers) if (p.queued) n += 1;
    return n;
  };

  const livePop = () => pop + (producingVil ? 1 : 0) + armyHeadcount();

  const ensureHousing = (needed: number): boolean => {
    while (housing < needed) {
      if (wood < HOUSE_WOOD) return false;
      wood -= HOUSE_WOOD;
      housing += HOUSE_POP;
    }
    return true;
  };
  const axe = () => techs.find((tech) => tech.key === "axe");
  const woodRate = () => (axe()?.done ? GATHER_RATES.woodAxe : GATHER_RATES.wood);

  samples.push(snapshot(0));

  for (let t = 1; t <= duration; t++) {
    const feudal = t >= FEUDAL_RESEARCH;
    const workingWood = Math.max(0, woodVils - (feudal ? 0 : 1));
    const workingGold = Math.max(0, goldVils - (feudal ? 0 : 1));

    food += foodVils * GATHER_RATES.food;
    wood += workingWood * woodRate();
    gold += workingGold * GATHER_RATES.gold;

    if (feudal && !buildingsPaid) {
      const parts: string[] = [];
      let paidNow = 0;
      const payOrder = [...producers].sort(
        (a, b) => Number(b.unit === "scout") - Number(a.unit === "scout"),
      );
      for (const p of payOrder) {
        if (p.paid) continue;
        if (scoutIntoArchers && p.unit === "archer") {
          delayedProduction.push({ paidAt: null });
          continue;
        }
        if (wood >= BUILDING_WOOD) {
          spendWood(BUILDING_WOOD, t, "Feudal buildings");
          p.paid = true;
          paidNow += 1;
        } else {
          delayedProduction.push({ paidAt: null });
        }
      }
      if (paidNow > 0) parts.push(`${paidNow}× ${BUILDING_WOOD}w production`);
      if (delayedProduction.length > 0) {
        parts.push(
          scoutIntoArchers
            ? "archery delayed until gold vils and wood"
            : `${delayedProduction.length} production delayed`,
        );
      }
      buildingsPaid = true;
      if (parts.length > 0) milestones.push({ t, label: parts.join(", "), tone: "wood" });
    }

    const canTrainVils = feudal;

    if (producingVil) {
      vilProgress += 1;
      if (vilProgress >= vilTime) {
        producingVil = false;
        pop += 1;
        vilsProduced += 1;
        const job = input.assignment[assignmentIndex] ?? "food";
        assignmentIndex += 1;
        assign(job, t);
      }
    }

    const onPeriod = isPeriod(t, periodStart, VIL_TRAIN);
    if (onPeriod) {
      const viable = feudal && food >= CASTLE_FOOD && gold >= CASTLE_GOLD;
      castleViable = viable;
      tickSnapshots.push({
        index: tickSnapshots.length,
        t,
        pop,
        food,
        gold,
        viable,
      });

      if (viable && canClickAt === null) {
        canClickAt = t;
        milestones.push({ t, label: "Castle Age viable (800f / 200g)", tone: "gold" });
      }
    }

    if (canTrainVils && !producingVil && food >= VIL_FOOD && ensureHousing(livePop() + 1)) {
      food -= VIL_FOOD;
      producingVil = true;
      vilProgress = 0;
    }

    const placingFood = producingVil && input.assignment[assignmentIndex] === "food";

    if (feudal) {
      for (const p of producers) {
        if (p.paid) continue;
        if (scoutIntoArchers && p.unit === "archer" && goldVils < 1) continue;
        if (wood >= BUILDING_WOOD && !placingFood) {
          const slot = delayedProduction.findIndex((d) => d.paidAt === null);
          samples.push(snapshot(t));
          spendWood(BUILDING_WOOD, t, "a production building");
          p.paid = true;
          if (slot >= 0) delayedProduction[slot].paidAt = t;
          samples.push(snapshot(t));
          const label =
            scoutIntoArchers && p.unit === "archer"
              ? "Archery range (175w)"
              : slot <= 0
                ? "Second production building (175w, delayed)"
                : "Extra production building (175w, delayed)";
          milestones.push({ t, label, tone: "wood" });
        }
      }
    }

    const extraDeclared = producers.filter((p) => p.needsBuilding).length;
    const secondDeclared = extraDeclared >= 2;
    const secondPaid = producers.filter((p) => p.needsBuilding && p.paid).length >= 2;
    const payBlacksmith = () => {
      if (!feudal || blacksmithPaid || wood < BLACKSMITH_WOOD || placingFood) return;
      if (!goldCampPaid) return;
      if (secondDeclared && !secondPaid) return;
      samples.push(snapshot(t));
      wood -= BLACKSMITH_WOOD;
      blacksmithPaid = true;
      blacksmithAt = t;
      samples.push(snapshot(t));
      milestones.push({ t, label: "Blacksmith (150w)", tone: "wood" });
    };
    const payOpeningFarms = () => {
      while (openingFarmsPaid < openingFarmsDueAt(t) && wood >= FARM_WOOD && !placingFood) {
        samples.push(snapshot(t));
        wood -= FARM_WOOD;
        openingFarmsPaid += 1;
        samples.push(snapshot(t));
      }
      while (pendingFarms > 0 && wood >= FARM_WOOD && !placingFood) {
        samples.push(snapshot(t));
        wood -= FARM_WOOD;
        pendingFarms -= 1;
        samples.push(snapshot(t));
      }
    };

    if (secondDeclared) {
      payBlacksmith();
      payOpeningFarms();
    } else {
      payOpeningFarms();
      payBlacksmith();
    }

    if (feudal) {
      let smithBusy = techs.some((tech) => tech.requiresBlacksmith && tech.researching);
      for (const tech of techs) {
        const smithOk = !tech.requiresBlacksmith || (blacksmithPaid && !smithBusy);
        if (
          tech.enabled &&
          !tech.done &&
          !tech.researching &&
          smithOk &&
          food >= tech.food &&
          wood >= tech.wood &&
          gold >= tech.gold
        ) {
          food -= tech.food;
          wood -= tech.wood;
          gold -= tech.gold;
          tech.researching = true;
          tech.progress = 0;
          if (tech.requiresBlacksmith) smithBusy = true;
        }
        if (tech.researching) {
          tech.progress += 1;
          if (tech.progress >= tech.time) {
            tech.researching = false;
            tech.done = true;
            if (tech.requiresBlacksmith) smithBusy = false;
            milestones.push({ t, label: tech.label, tone: tech.tone });
          }
        }
      }
    }

    const armyOnline = feudal && t >= FEUDAL_RESEARCH + ARMY_DELAY;
    if (armyOnline) {
      const maaReady = !needsMaa || Boolean(techs.find((tech) => tech.key === "maa")?.done);
      for (const p of producers) {
        const unit = UNITS[p.unit];
        if (p.queued) {
          p.remaining -= 1;
          if (p.remaining <= 0) {
            p.queued = false;
            armyCounts[p.unit] = (armyCounts[p.unit] ?? 0) + 1;
          }
        } else if (
          p.paid &&
          (p.unit !== "maa" || maaReady) &&
          (armyCounts[p.unit] ?? 0) + producers.filter((x) => x.unit === p.unit && x.queued).length < p.target &&
          food >= unit.food &&
          gold >= unit.gold &&
          wood >= unit.wood
        ) {
          if (!ensureHousing(livePop() + 1) || wood < unit.wood) continue;
          food -= unit.food;
          wood -= unit.wood;
          gold -= unit.gold;
          p.queued = true;
          p.remaining = unit.trainTime;
        } else if (unit.gold > 0 && gold < unit.gold) {
          starvedTicks += 1;
        }
      }
    }

    if (t % 5 === 0 || onPeriod || t === duration) samples.push(snapshot(t));
  }

  const final = samples[samples.length - 1];

  return {
    samples,
    ticks: tickSnapshots,
    milestones,
    canClickAt,
    castleArriveAt: canClickAt === null ? null : canClickAt + CASTLE_RESEARCH,
    blacksmithAt,
    final,
    armyProduced: { ...armyCounts },
    buildingWood,
    vilsProduced,
    starvedTicks,
    gameStartOffset,
    woodBrokeAt,
    woodBrokePop,
    woodBrokeReason,
    delayedProduction,
  };
}

export function castleWindowTicks(input: ModelInput, autoAssign = true): number {
  const opening = input.foodVils + input.woodVils + input.goldVils + input.builderVils;
  const assignment = autoAssign
    ? extendAssignment(input.assignment, MAX_NEW_VILS, input.foodVils)
    : padAssignment(input.assignment, MAX_NEW_VILS, "idle");
  const probe = simulate({ ...input, ticks: MAX_NEW_VILS, assignment });
  const first = probe.ticks.find((tick) => tick.viable);
  if (!first) return MAX_NEW_VILS;
  const minNew = Math.max(first.index + 1, first.pop - opening);
  return Math.min(MAX_NEW_VILS, Math.max(1, minNew + CASTLE_EXTRA_VILS));
}
