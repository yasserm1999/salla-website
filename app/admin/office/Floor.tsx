"use client";

import { useEffect, useRef, useState } from "react";
import type { Desk, Mood } from "@/lib/office";
import type { AgendaItem } from "@/lib/meeting";
import { AgendaBoard, StatTiles } from "./AgendaBoard";

/**
 * The office, seen from above and in front, like a doll's house.
 *
 * Every worker has their own desk — computer, keyboard, a mug, a chair, and
 * the thing their job needs: the till for billing, the iron for pressing, the
 * van keys for deliveries. They stay at it; their light and the colour of
 * their screen say how their corner of the shop is doing.
 *
 * The morning meeting walks everybody into the meeting room and goes through
 * the owner's agenda, each point presented by the worker whose corner it is,
 * with the board below lighting the point under discussion.
 *
 * The movement is decoration over the real numbers, never a substitute for
 * them: clicking anyone opens exactly the card the list view shows.
 *
 * How the depth is faked: the room is wider than it is deep so the floor reads
 * as tilted away; every object has a top and a front; and whatever stands
 * further forward is drawn over whatever stands behind it. No 3D library, so
 * it stays light on a phone.
 */

type Spot = { x: number; y: number };

type Look = { shirt: string; trousers: string; skin: string; hair: string; long?: boolean };

type Prop =
  | "plant"
  | "tickets"
  | "iron"
  | "boxes"
  | "keys"
  | "till"
  | "phone"
  | "chart"
  | "magnifier";

/** Each worker's desk, what is on it, and what they look like. */
const SEATING: Record<string, { desk: Spot; prop: Prop; look: Look }> = {
  manager: {
    desk: { x: 60, y: 96 },
    prop: "plant",
    look: { shirt: "#26364d", trousers: "#1f2937", skin: "#c68863", hair: "#1c1917" },
  },
  orders: {
    desk: { x: 48, y: 47 },
    prop: "tickets",
    look: { shirt: "#c2410c", trousers: "#334155", skin: "#e0ac85", hair: "#3f2a1d" },
  },
  pressing: {
    desk: { x: 67, y: 47 },
    prop: "iron",
    look: { shirt: "#0f766e", trousers: "#1f2937", skin: "#b07650", hair: "#111827" },
  },
  supplies: {
    desk: { x: 86, y: 47 },
    prop: "boxes",
    look: { shirt: "#0e7490", trousers: "#475569", skin: "#d39b74", hair: "#57381f" },
  },
  billing: {
    desk: { x: 10, y: 73 },
    prop: "till",
    look: { shirt: "#b45309", trousers: "#1f2937", skin: "#f1c6a3", hair: "#6b3f1d", long: true },
  },
  customer: {
    desk: { x: 26.5, y: 73 },
    prop: "phone",
    look: { shirt: "#be185d", trousers: "#334155", skin: "#c68863", hair: "#111827", long: true },
  },
  marketing: {
    desk: { x: 43, y: 73 },
    prop: "chart",
    look: { shirt: "#4f46e5", trousers: "#1e293b", skin: "#e8b48f", hair: "#2b1d14" },
  },
  quality: {
    desk: { x: 60, y: 73 },
    prop: "magnifier",
    look: { shirt: "#7c3aed", trousers: "#1e293b", skin: "#8d5a3b", hair: "#111827", long: true },
  },
  delivery: {
    desk: { x: 77, y: 73 },
    prop: "keys",
    look: { shirt: "#15803d", trousers: "#374151", skin: "#a8714d", hair: "#1c1917" },
  },
};

/** The meeting table, and places round it — the manager at the far end. */
const TABLE = { x: 20, y: 30 };
const CHAIRS: Spot[] = Array.from({ length: 9 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 9;
  return { x: TABLE.x + Math.cos(a) * 14, y: TABLE.y + 3 + Math.sin(a) * 12 };
});

const DESK_W = 13; // percent of the room's width
/** Sitting at the desk: just behind it, so the desk hides the legs. */
const atDesk = (d: Spot): Spot => ({ x: d.x + 2.2, y: d.y - 4.5 });

/** How long a walk takes, in milliseconds. Red work is walked to faster. */
const PACE: Record<Mood, number> = { alert: 1400, busy: 2000, calm: 2600 };

const LIGHT: Record<Mood, string> = { alert: "#dc2626", busy: "#f59e0b", calm: "#10b981" };

const TURN_MS = 9000;

/** Further forward is drawn on top. */
const depth = (y: number) => Math.round(y * 10);

type Walker = Spot & { moving: boolean; away: boolean; left: boolean };

export function Floor({
  desks,
  agenda,
  selected,
  onSelect,
}: {
  desks: Desk[];
  agenda: AgendaItem[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const seated = desks.filter((d) => SEATING[d.key]);
  const byKey = new Map(seated.map((d) => [d.key, d]));
  const home = (key: string) => atDesk(SEATING[key].desk);
  const titles = Object.fromEntries(desks.map((d) => [d.key, d.title]));

  const [walkers, setWalkers] = useState<Record<string, Walker>>(() =>
    Object.fromEntries(
      seated.map((d) => [d.key, { ...home(d.key), moving: false, away: false, left: false }])
    )
  );

  /*
    The meeting: null when everybody is working, otherwise the step. Step -1
    is everybody walking in; 0 is the manager opening; 1..n are the agenda
    points; n+1 is the manager closing.
  */
  const [turn, setTurn] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const meeting = turn !== null;
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** Send one worker somewhere, facing the way they walk, and let them stop on arrival. */
  const send = (key: string, to: Spot, away: boolean, mood: Mood) => {
    setWalkers((w) => {
      const from = w[key];
      const left = from ? (Math.abs(to.x - from.x) < 0.5 ? from.left : to.x < from.x) : false;
      return { ...w, [key]: { ...to, moving: true, away, left } };
    });
    later(
      () => setWalkers((w) => (w[key] ? { ...w, [key]: { ...w[key], moving: false } } : w)),
      PACE[mood]
    );
  };

  /*
    Outside the meeting everybody stays at their own desk. They used to get
    up and walk to the machines or the counter, but the owner wants to see
    each worker in their place, so the only walking is to the meeting room
    and back.
  */

  // ── The meeting ─────────────────────────────────────────────────────
  const points = agenda.filter((a) => byKey.has(a.presenter));
  const closing = points.length + 1;

  const startMeeting = () => {
    onSelect(null);
    setPaused(false);
    setTurn(-1);
    seated.forEach((d, i) => send(d.key, CHAIRS[i % CHAIRS.length], true, "busy"));
    later(() => setTurn(0), 2600);
  };

  const endMeeting = () => {
    setTurn(null);
    seated.forEach((d) => send(d.key, home(d.key), false, "calm"));
  };

  useEffect(() => {
    if (turn === null || turn < 0 || paused) return;
    const id = window.setTimeout(() => {
      if (turn >= closing) endMeeting();
      else setTurn(turn + 1);
    }, TURN_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, paused, closing]);

  const point = turn !== null && turn >= 1 && turn <= points.length ? points[turn - 1] : null;
  const speakerKey =
    turn === null || turn < 0 ? null : point ? point.presenter : "manager";
  const said =
    turn === null || turn < 0
      ? null
      : turn === 0
        ? `Good morning, everyone. We have ${points.length} things to go through: ${points
            .map((p) => p.title.toLowerCase())
            .join(", ")}.`
        : point
          ? point.headline
          : "That's everything. Thank you — back to work!";

  const control =
    "rounded-lg border border-[#d8cbbd] bg-white px-3 py-2 text-sm font-semibold text-[#546d83] disabled:opacity-40";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!meeting ? (
          <button
            onClick={startMeeting}
            className="rounded-lg bg-[#26364d] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f4f61]"
          >
            Start the morning meeting
          </button>
        ) : (
          <>
            <button
              onClick={() => turn !== null && turn > 0 && setTurn(turn - 1)}
              disabled={turn === null || turn <= 0}
              className={control}
            >
              Back
            </button>
            <button onClick={() => setPaused((p) => !p)} disabled={turn === null || turn < 0} className={control}>
              {paused ? "Carry on" : "Pause"}
            </button>
            <button
              onClick={() => turn !== null && (turn >= closing ? endMeeting() : setTurn(Math.max(0, turn + 1)))}
              className={control}
            >
              Next
            </button>
            <button onClick={endMeeting} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
              End meeting
            </button>
          </>
        )}
        <span className="text-xs text-[#8a9099]">Tap anyone to see their work.</span>
      </div>

      {/* The room. Padding on top leaves space for speech above the back row. */}
      <div className="isolate rounded-2xl bg-[#26364d] p-2 pt-12 shadow-lg sm:pt-16">
        <div
          className="relative w-full select-none"
          style={{ aspectRatio: "16 / 11", minHeight: 320 }}
          onClick={() => onSelect(null)}
        >
          {/* Back wall, with a window and a clock */}
          <div
            className="absolute inset-x-0 top-0 rounded-t-lg"
            style={{ height: "12%", background: "linear-gradient(#ece5da, #d9cdbd)", borderBottom: "3px solid #bfae98" }}
          >
            <span className="absolute right-3 top-1 text-[10px] font-black tracking-[0.3em] text-[#b9925d] sm:text-xs">
              SALLA
            </span>
            <span
              className="absolute top-[18%] h-[58%] w-[14%] rounded-sm border-[3px] border-[#f5f0e8]"
              style={{ left: "24%", background: "linear-gradient(160deg, #bfe3f5, #8ccbe8 60%, #dff1fa)" }}
            />
            <span className="absolute top-[22%] flex aspect-square h-[46%] items-center justify-center rounded-full border-2 border-[#26364d] bg-white" style={{ left: "2%" }}>
              <span className="absolute h-[34%] w-[2px] origin-bottom -translate-y-1/2 rotate-[300deg] bg-[#26364d]" />
              <span className="absolute h-[24%] w-[2px] origin-bottom -translate-y-1/2 rotate-[60deg] bg-[#26364d]" />
            </span>
          </div>

          {/* Floor: wooden boards squashed in depth, which is what makes it lie down */}
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-lg"
            style={{
              top: "12%",
              backgroundColor: "#e9dcc8",
              backgroundImage:
                "linear-gradient(#dccbb2 1px, transparent 1px), linear-gradient(90deg, rgba(204,185,158,0.55) 1px, transparent 1px)",
              backgroundSize: "100% 4.5%, 12.5% 9%",
              boxShadow: "inset 0 18px 24px -14px rgba(38,54,77,0.35)",
            }}
          />

          {/* Meeting room: a rug, the table, a screen on the wall, a glass front */}
          <div
            className="absolute rounded-md"
            style={{
              left: "1.5%",
              top: "13%",
              width: "37%",
              height: "35%",
              backgroundColor: meeting ? "#e7d2b4" : "#e2d3bd",
              boxShadow: "inset 0 0 0 3px rgba(185,146,93,0.35)",
              transition: "background-color 600ms",
            }}
          >
            <span className="absolute left-2 top-1 text-[9px] font-bold uppercase tracking-wider text-[#b9925d] sm:text-[10px]">
              Meeting room
            </span>
          </div>
          <div
            className="absolute flex items-center justify-center rounded-sm border-2 border-[#1f2937] bg-[#26364d] text-[7px] font-bold text-white sm:text-[9px]"
            style={{ left: "13%", top: "2%", width: "10%", height: "8%" }}
          >
            {meeting && point ? `${point.number}. ${point.title}` : meeting ? "Agenda" : ""}
          </div>
          <Wall x={1.5} y={48} w={25} />
          <Wall x={33} y={48} w={5.5} />
          <div
            className="absolute bg-[#cbd5dc]/60"
            style={{ left: "38.3%", top: "13%", width: "0.5%", height: "35.5%", zIndex: depth(30) }}
          />
          <Table x={TABLE.x} y={TABLE.y + 6} />

          {/* Washing machines and dryers */}
          {[44, 51, 58].map((x) => (
            <Machine key={x} x={x} />
          ))}

          {/* Pressing station: two ironing boards */}
          <IroningBoard x={68} y={24} />
          <IroningBoard x={77} y={24} />

          {/* Shelves */}
          <Shelf x={89} />

          {/* Van door, in the right-hand wall */}
          <div
            className="absolute flex items-center justify-center rounded-l-md"
            style={{
              right: 0,
              top: "52%",
              width: "3.5%",
              height: "16%",
              background: "linear-gradient(90deg, #3f4f61, #26364d)",
              zIndex: depth(66),
            }}
            title="Van door"
          >
            <span className="rotate-90 whitespace-nowrap text-[8px] font-bold uppercase tracking-widest text-white sm:text-[9px]">
              Van
            </span>
          </div>

          {/* Counter */}
          <Counter x={18} y={99} />

          {/* Chairs, desks */}
          {seated.map((d) => {
            const desk = SEATING[d.key].desk;
            return (
              <div key={`seat-${d.key}`}>
                <OfficeChair x={desk.x + 2.2} y={desk.y - 5.5} colour={SEATING[d.key].look.shirt} />
                <OfficeDesk
                  x={desk.x}
                  y={desk.y}
                  label={d.title}
                  prop={SEATING[d.key].prop}
                  lead={d.key === "manager"}
                  mood={d.mood}
                />
              </div>
            );
          })}

          {/* People */}
          {seated.map((d) => {
            const w = walkers[d.key];
            if (!w) return null;
            const isSpeaking = speakerKey === d.key;
            const isSelected = selected === d.key;
            const align = w.x < 25 ? "left" : w.x > 75 ? "right" : "center";
            return (
              <button
                key={d.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(isSelected ? null : d.key);
                }}
                aria-label={`${d.title}: ${d.headline}`}
                className="group absolute focus:outline-none"
                style={{
                  left: `${w.x}%`,
                  top: `${w.y}%`,
                  transform: "translate(-50%, -100%)",
                  transitionProperty: "left, top",
                  transitionDuration: `${PACE[d.mood]}ms`,
                  transitionTimingFunction: "linear",
                  zIndex: isSpeaking || isSelected ? 2000 : depth(w.y),
                }}
              >
                {isSpeaking && said && (
                  <span
                    className={`absolute bottom-full mb-1 w-52 rounded-xl border border-[#d8cbbd] bg-white p-2 text-left text-[10px] leading-snug text-[#26364d] shadow-xl sm:w-64 sm:text-[11px] ${
                      align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {point && <span className="mb-0.5 block font-bold text-[#b9925d]">{point.number}. {point.title}</span>}
                    <span className="line-clamp-4">{said}</span>
                  </span>
                )}
                <Person
                  look={SEATING[d.key].look}
                  moving={w.moving}
                  facingLeft={w.left}
                  mood={d.mood}
                  highlight={isSelected || isSpeaking}
                />
                <span className="absolute left-1/2 top-full mt-0.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[9px] font-semibold text-[#3f4f61] shadow-sm group-hover:block">
                  {d.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What is being said, readable at any size */}
      {meeting && (
        <div className="mt-3 rounded-xl border-2 border-[#d8b98a] bg-[#f8f1e7] p-3" aria-live="polite">
          {turn === -1 ? (
            <p className="text-sm text-[#546d83]">Everyone is walking to the meeting room…</p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-[#b9925d]">
                {speakerKey ? titles[speakerKey] : ""}
                <span className="ms-2 font-normal normal-case text-[#8a9099]">
                  {point ? `point ${point.number} of ${points.length}` : turn === 0 ? "opening" : "closing"}
                  {paused ? " · paused" : ""}
                </span>
              </p>
              <p className="mt-1 text-base font-semibold text-[#26364d]">{said}</p>
              {point && point.stats.length > 0 && <StatTiles stats={point.stats} indent={false} />}
            </>
          )}
        </div>
      )}

      <AgendaBoard agenda={agenda} current={point?.key ?? null} presenters={titles} />

      <style>{`
        @keyframes office-leg-a { 0%,100% { transform: rotate(22deg); } 50% { transform: rotate(-22deg); } }
        @keyframes office-leg-b { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(22deg); } }
        @keyframes office-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.2px); } }
        @keyframes office-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.5px); } }
        @keyframes office-steam { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: .8; } 100% { opacity: 0; transform: translateY(-6px); } }
        .office-person .leg-a, .office-person .leg-b, .office-person .arm-a, .office-person .arm-b {
          transform-box: fill-box; transform-origin: 50% 0%;
        }
        .office-person .upper { animation: office-breathe 3.2s ease-in-out infinite; }
        .office-person.walking .upper { animation: office-bob 0.25s ease-in-out infinite; }
        .office-person.walking .leg-a, .office-person.walking .arm-b { animation: office-leg-a 0.5s ease-in-out infinite; }
        .office-person.walking .leg-b, .office-person.walking .arm-a { animation: office-leg-b 0.5s ease-in-out infinite; }
        .office-steam { animation: office-steam 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .office-person .upper, .office-person .leg-a, .office-person .leg-b,
          .office-person .arm-a, .office-person .arm-b, .office-steam { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── People ─────────────────────────────────────────────────────────────

/**
 * One person, drawn standing: shadow, legs, body, arms, head and hair, and the
 * status light floating over them. Legs and arms swing while they walk.
 */
function Person({
  look,
  moving,
  facingLeft,
  mood,
  highlight,
}: {
  look: Look;
  moving: boolean;
  facingLeft: boolean;
  mood: Mood;
  highlight: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 72"
      className={`office-person block h-[clamp(50px,8.2vw,88px)] w-auto overflow-visible drop-shadow-sm transition-transform group-hover:-translate-y-0.5 ${
        moving ? "walking" : ""
      }`}
      style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}
    >
      <ellipse cx="20" cy="69" rx={highlight ? 13 : 10} ry="3" fill={highlight ? "#d8b98a" : "#000"} opacity={highlight ? 0.85 : 0.22} />

      <circle cx="20" cy="2.5" r="3" fill={LIGHT[mood]} stroke="#fff" strokeWidth="1.2">
        {mood === "alert" && <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />}
      </circle>

      <g>
        <rect className="leg-a" x="14.5" y="44" width="5" height="22" rx="2.5" fill={look.trousers} />
        <rect className="leg-b" x="20.5" y="44" width="5" height="22" rx="2.5" fill={look.trousers} />
        <ellipse cx="17" cy="66.5" rx="3.6" ry="1.8" fill="#1f2937" />
        <ellipse cx="23" cy="66.5" rx="3.6" ry="1.8" fill="#1f2937" />
      </g>

      <g className="upper">
        <rect className="arm-a" x="10" y="25" width="4.5" height="17" rx="2.25" fill={look.shirt} opacity="0.85" />
        <path d="M12 26 Q12 22 16 21.5 L24 21.5 Q28 22 28 26 L28.5 46 Q20 48.5 11.5 46 Z" fill={look.shirt} />
        <path d="M24 22 Q28 22.5 28 26 L28.5 46 Q26 47 24 47.3 Z" fill="#000" opacity="0.12" />
        <path d="M17 21.6 L20 25 L23 21.6" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7" />
        <rect className="arm-b" x="25.5" y="25" width="4.5" height="17" rx="2.25" fill={look.shirt} />
        <circle cx="27.8" cy="43" r="2.2" fill={look.skin} />
        <rect x="18" y="17" width="4" height="5" fill={look.skin} />
        <ellipse cx="20" cy="12.5" rx="6.8" ry="7.3" fill={look.skin} />
        <ellipse cx="22.5" cy="13" rx="4" ry="6.5" fill="#000" opacity="0.06" />
        {look.long ? (
          <path d="M13 13 Q12.5 4.5 20 4.6 Q27.5 4.5 27 13 L27.5 22 Q25 19 25.5 12 Q22 9 14.5 12 Q15 19 12.5 22 Z" fill={look.hair} />
        ) : (
          <path d="M13.2 12 Q13 4.8 20 4.8 Q27 4.8 26.8 12 Q24 8.5 20 8.6 Q15.5 8.5 13.2 12 Z" fill={look.hair} />
        )}
        <circle cx="22.6" cy="12.6" r="0.85" fill="#1f2937" />
        <circle cx="25.2" cy="12.6" r="0.85" fill="#1f2937" />
        <path d="M22.8 15.8 Q24 16.7 25.2 15.8" fill="none" stroke="#7c2d12" strokeWidth="0.7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ── Furniture ──────────────────────────────────────────────────────────

/** Anchored by the middle of its front edge on the floor. */
const anchored = (x: number, y: number, w: number, z = y): React.CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
  width: `${w}%`,
  transform: "translate(-50%, -100%)",
  zIndex: depth(z),
});

/**
 * A proper office desk: a wooden top seen from above and in front, a modesty
 * panel with the worker's name plate, a drawer pedestal, legs, a computer with
 * a lit screen, a keyboard and mouse, a mug, and the thing their job needs.
 */
function OfficeDesk({
  x,
  y,
  label,
  prop,
  lead,
  mood,
}: {
  x: number;
  y: number;
  label: string;
  prop: Prop;
  lead: boolean;
  mood: Mood;
}) {
  const top = lead ? "#a47b55" : "#d4b48f";
  const edge = lead ? "#7c5a3c" : "#b08d66";
  const panel = lead ? "#6b4c32" : "#9c7a55";
  return (
    <svg
      viewBox="0 0 130 84"
      className="pointer-events-none absolute overflow-visible"
      style={anchored(x, y, DESK_W)}
    >
      {/* Shadow */}
      <ellipse cx="65" cy="82" rx="62" ry="3" fill="#000" opacity="0.15" />
      {/* Legs */}
      <rect x="7" y="48" width="5" height="33" rx="1" fill={panel} />
      <rect x="118" y="48" width="5" height="33" rx="1" fill={panel} />
      {/* Modesty panel and name plate */}
      <rect x="10" y="47" width="110" height="20" fill={panel} />
      <rect x="30" y="51" width="60" height="11" rx="2" fill="#f7f1e6" stroke="#b9925d" strokeWidth="1" />
      <text x="60" y="59" textAnchor="middle" fontSize="7" fontWeight="700" fill="#26364d" fontFamily="system-ui, sans-serif">
        {label.length > 20 ? `${label.slice(0, 19)}…` : label}
      </text>
      {/* Drawer pedestal */}
      <rect x="94" y="47" width="26" height="34" rx="1" fill={edge} />
      <line x1="94" y1="58" x2="120" y2="58" stroke={panel} strokeWidth="1" />
      <line x1="94" y1="69" x2="120" y2="69" stroke={panel} strokeWidth="1" />
      <rect x="104" y="51.5" width="6" height="1.6" rx="0.8" fill="#e7d8c0" />
      <rect x="104" y="62.5" width="6" height="1.6" rx="0.8" fill="#e7d8c0" />
      <rect x="104" y="73.5" width="6" height="1.6" rx="0.8" fill="#e7d8c0" />
      {/* The top: a parallelogram seen from above, then its front edge */}
      <path d="M12 26 L118 26 L126 42 L4 42 Z" fill={top} />
      <path d="M12 26 L118 26 L119 28 L11 28 Z" fill="#fff" opacity="0.18" />
      <rect x="4" y="42" width="122" height="5" fill={edge} />
      {/* Computer on the left, so the worker sitting right of centre is not hidden by it */}
      <g transform="translate(-16 0)">
      <rect x="40" y="22" width="12" height="6" fill="#374151" />
      <rect x="44" y="14" width="4" height="10" fill="#4b5563" />
      <rect x="22" y="-6" width="48" height="22" rx="2" fill="#111827" />
      <rect x="24.5" y="-3.5" width="43" height="17" rx="1" fill={mood === "alert" ? "#7f1d1d" : "#1e3a5f"} />
      <rect x="27" y="-1" width="18" height="2" rx="1" fill="#93c5fd" opacity="0.9" />
      <rect x="27" y="3" width="30" height="1.5" rx="0.75" fill="#bfdbfe" opacity="0.6" />
      <rect x="27" y="6.5" width="24" height="1.5" rx="0.75" fill="#bfdbfe" opacity="0.6" />
      <rect x="27" y="10" width={mood === "alert" ? 36 : 14} height="1.5" rx="0.75" fill={LIGHT[mood]} opacity="0.95" />
      </g>
      {/* Keyboard, in front of where they sit */}
      <g transform="translate(36 0)">
        <path d="M28 31 L64 31 L66 37 L26 37 Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.6" />
        <path d="M30 33 L62 33 M29.5 35 L63 35" stroke="#9ca3af" strokeWidth="0.5" />
      </g>
      {/* Mug */}
      <g transform="translate(46 0)">
        <rect x="10" y="28" width="6" height="7" rx="1.2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.6" />
        <path d="M16 30 Q19 31.5 16 33.5" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
        <ellipse cx="13" cy="28.3" rx="2.6" ry="0.9" fill="#7c4a2b" />
      </g>
      <DeskProp prop={prop} />
    </svg>
  );
}

/** What sits on each desk because of the job done at it. */
function DeskProp({ prop }: { prop: Prop }) {
  switch (prop) {
    case "plant":
      return (
        <g>
          <path d="M104 26 L114 26 L112.5 38 L105.5 38 Z" fill="#b45309" />
          <ellipse cx="109" cy="18" rx="9" ry="9" fill="#15803d" />
          <ellipse cx="104" cy="14" rx="5" ry="6" fill="#16a34a" />
          <ellipse cx="114" cy="15" rx="5" ry="6" fill="#22c55e" />
        </g>
      );
    case "tickets":
      return (
        <g>
          <rect x="101" y="14" width="17" height="24" rx="1.5" fill="#92400e" />
          <rect x="103" y="18" width="13" height="18" fill="#fff" />
          <rect x="106" y="12" width="7" height="4" rx="1" fill="#9ca3af" />
          <path d="M105 22 L114 22 M105 26 L114 26 M105 30 L111 30" stroke="#ef4444" strokeWidth="1" />
        </g>
      );
    case "iron":
      return (
        <g>
          <path d="M100 37 Q100 26 112 26 L120 26 L120 37 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.8" />
          <path d="M106 26 Q108 19 116 20 L118 26" fill="none" stroke="#0f766e" strokeWidth="2.5" />
          <path className="office-steam" d="M104 22 Q102 18 104 14" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
        </g>
      );
    case "boxes":
      return (
        <g>
          <rect x="100" y="26" width="12" height="11" fill="#d6b48a" stroke="#a47b55" strokeWidth="0.6" />
          <rect x="108" y="22" width="12" height="15" fill="#c8a57c" stroke="#a47b55" strokeWidth="0.6" />
          <rect x="103" y="15" width="11" height="10" fill="#e0c39e" stroke="#a47b55" strokeWidth="0.6" />
          <path d="M108 15 L108 25" stroke="#a47b55" strokeWidth="0.6" />
        </g>
      );
    case "keys":
      return (
        <g>
          <path d="M99 28 L119 26 L121 38 L101 40 Z" fill="#dcfce7" stroke="#86efac" strokeWidth="0.6" />
          <path d="M102 36 Q108 30 112 33 T119 29" fill="none" stroke="#15803d" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <circle cx="119" cy="29" r="1.6" fill="#dc2626" />
          <circle cx="104" cy="23" r="3" fill="none" stroke="#a16207" strokeWidth="1.2" />
          <rect x="106" y="22" width="6" height="2" fill="#a16207" />
        </g>
      );
    case "till":
      return (
        <g>
          <path d="M100 38 L102 26 L120 26 L122 38 Z" fill="#374151" />
          <rect x="104" y="15" width="14" height="10" rx="1" fill="#1f2937" />
          <rect x="106" y="17" width="10" height="5" fill="#4ade80" />
          <path d="M104 29 L118 29 M104 32 L119 32 M103 35 L119 35" stroke="#9ca3af" strokeWidth="0.8" />
        </g>
      );
    case "phone":
      return (
        <g>
          <path d="M102 38 L104 30 L118 30 L120 38 Z" fill="#be185d" />
          <path d="M101 29 Q101 24 106 24 L116 24 Q121 24 121 29 L117 29 Q117 27 114 27 L108 27 Q105 27 105 29 Z" fill="#9d174d" />
          <circle cx="111" cy="34" r="2.2" fill="#fbcfe8" />
        </g>
      );
    case "chart":
      return (
        <g>
          <rect x="100" y="12" width="20" height="26" rx="1" fill="#fff" stroke="#c7d2fe" strokeWidth="0.8" />
          <rect x="103" y="28" width="3" height="7" fill="#818cf8" />
          <rect x="108" y="23" width="3" height="12" fill="#6366f1" />
          <rect x="113" y="18" width="3" height="17" fill="#4f46e5" />
        </g>
      );
    case "magnifier":
      return (
        <g>
          <path d="M99 30 L113 28 L118 38 L102 40 Z" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="0.6" />
          <circle cx="114" cy="24" r="5" fill="#dbeafe" fillOpacity="0.6" stroke="#6b7280" strokeWidth="1.5" />
          <path d="M110.5 27.5 L105 33" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
  }
}

/** An office chair: back, seat, gas lift and five-star base. */
function OfficeChair({ x, y, colour }: { x: number; y: number; colour: string }) {
  return (
    <svg viewBox="0 0 40 52" className="pointer-events-none absolute overflow-visible" style={anchored(x, y, 4.6)}>
      <ellipse cx="20" cy="50" rx="14" ry="2" fill="#000" opacity="0.15" />
      <path d="M8 48 L20 44 L32 48 M20 44 L20 49" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
      <rect x="18.5" y="32" width="3" height="12" fill="#4b5563" />
      <rect x="9" y="2" width="22" height="24" rx="6" fill={colour} />
      <rect x="9" y="2" width="22" height="24" rx="6" fill="#000" opacity="0.25" />
      <ellipse cx="20" cy="31" rx="13" ry="4.5" fill="#1f2937" />
      <ellipse cx="20" cy="29.5" rx="12" ry="3.6" fill={colour} opacity="0.75" />
    </svg>
  );
}

/** The round meeting table. */
function Table({ x, y }: { x: number; y: number }) {
  return (
    <svg viewBox="0 0 120 54" className="pointer-events-none absolute overflow-visible" style={anchored(x, y, 19)}>
      <ellipse cx="60" cy="50" rx="44" ry="4" fill="#000" opacity="0.15" />
      <rect x="54" y="26" width="12" height="24" fill="#7c5a3c" />
      <ellipse cx="60" cy="24" rx="58" ry="20" fill="#9c7a52" />
      <ellipse cx="60" cy="20" rx="58" ry="19" fill="#c8a57c" />
      <ellipse cx="60" cy="18" rx="46" ry="12" fill="#fff" opacity="0.08" />
      {/* Papers and a jug for the meeting */}
      <rect x="28" y="14" width="12" height="8" fill="#fff" transform="rotate(-8 34 18)" />
      <rect x="78" y="16" width="12" height="8" fill="#fff" transform="rotate(10 84 20)" />
      <rect x="56" y="6" width="8" height="12" rx="2" fill="#bae6fd" opacity="0.85" />
    </svg>
  );
}

/** A low glass wall along the front of the meeting room. */
function Wall({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <div
      className="pointer-events-none absolute rounded-sm border-t-2 border-[#9fb3c2]"
      style={{
        left: `${x}%`,
        top: `${y - 3}%`,
        width: `${w}%`,
        height: "3%",
        background: "linear-gradient(rgba(203,213,220,0.75), rgba(203,213,220,0.35))",
        zIndex: depth(y),
      }}
    />
  );
}

/** A front-loading washing machine against the back wall. */
function Machine({ x }: { x: number }) {
  return (
    <svg viewBox="0 0 40 50" className="pointer-events-none absolute overflow-visible" style={anchored(x, 17, 6.2)}>
      <rect x="1" y="1" width="38" height="48" rx="4" fill="#eef2f5" stroke="#b8c4ce" strokeWidth="1.2" />
      <rect x="1" y="1" width="38" height="10" rx="4" fill="#dfe6ec" />
      <circle cx="31" cy="6" r="2.4" fill="#94a3b8" />
      <rect x="5" y="4.5" width="14" height="3" rx="1" fill="#4ade80" opacity="0.8" />
      <circle cx="20" cy="30" r="13" fill="#9aa9b8" />
      <circle cx="20" cy="30" r="10.5" fill="url(#office-water)" />
      <path d="M12 32 Q16 28 20 32 T28 32" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7" />
      <defs>
        <radialGradient id="office-water" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="60%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** An ironing board with an iron on it. */
function IroningBoard({ x, y }: { x: number; y: number }) {
  return (
    <svg viewBox="0 0 70 40" className="pointer-events-none absolute overflow-visible" style={anchored(x, y, 8)}>
      <ellipse cx="35" cy="38.5" rx="28" ry="2" fill="#000" opacity="0.15" />
      <path d="M14 14 L56 38 M56 14 L14 38" stroke="#6b7280" strokeWidth="2" />
      <path d="M4 12 Q4 6 14 6 L58 6 Q68 9 66 12 L60 15 L8 15 Q4 15 4 12 Z" fill="#a5b4fc" stroke="#6366f1" strokeWidth="1" />
      <path d="M8 9 L60 9" stroke="#fff" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
      <path d="M40 9 Q40 2 48 2 L54 2 L54 9 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.8" />
      <path className="office-steam" d="M42 2 Q40 -2 42 -6" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
    </svg>
  );
}

/** A shelving unit of supplies against the back wall. */
function Shelf({ x }: { x: number }) {
  const rows = [
    ["#d6b48a", "#93c5fd", "#fca5a5"],
    ["#fca5a5", "#d6b48a", "#86efac"],
    ["#86efac", "#fde68a", "#d6b48a"],
  ];
  return (
    <svg viewBox="0 0 90 70" className="pointer-events-none absolute overflow-visible" style={anchored(x, 17, 12)}>
      <rect x="1" y="1" width="88" height="68" rx="2" fill="#b08a62" stroke="#8f6e4b" strokeWidth="2" />
      {rows.map((row, r) => (
        <g key={r}>
          {row.map((c, i) => (
            <rect key={i} x={7 + i * 27} y={5 + r * 22} width={21} height={15} rx="1" fill={c} stroke="#00000022" />
          ))}
          <rect x="1" y={21 + r * 22} width="88" height="3" fill="#8f6e4b" />
        </g>
      ))}
    </svg>
  );
}

/** The shop counter, with a till and a bell. */
function Counter({ x, y }: { x: number; y: number }) {
  return (
    <svg viewBox="0 0 160 46" className="pointer-events-none absolute overflow-visible" style={anchored(x, y, 26)}>
      <ellipse cx="80" cy="44" rx="78" ry="3" fill="#000" opacity="0.15" />
      <path d="M8 8 L152 8 L158 20 L2 20 Z" fill="#6b8399" />
      <rect x="2" y="20" width="156" height="24" fill="#546d83" />
      <text x="80" y="36" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" letterSpacing="2" fontFamily="system-ui, sans-serif">
        COUNTER
      </text>
      <rect x="20" y="0" width="22" height="12" rx="1" fill="#1f2937" />
      <rect x="23" y="2" width="16" height="5" fill="#4ade80" />
      <path d="M118 13 Q118 6 124 6 Q130 6 130 13 Z" fill="#eab308" />
      <circle cx="124" cy="5" r="1.2" fill="#a16207" />
    </svg>
  );
}
