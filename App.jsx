import React, { useState, useEffect, useRef } from "react";
import { SQUADS_ALLTIME, SQUADS_WC26, OPPONENTS } from "./data";

// ☕ Replace with your own Buy Me a Coffee page before launch
const BMC_LINK = "https://buymeacoffee.com/YOUR_PAGE_HERE";
const SITE_NAME = "Road to 8–0"; // appears on share images

// ── persistence (localStorage on a real site, in-memory fallback elsewhere) ──
let mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch (e) { return k in mem ? mem[k] : d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; } },
};

// ── daily seed ──
const DAY = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const DAILY_NUM = Math.max(1, Math.round((Date.parse(DAY) - Date.parse("2026-06-11")) / 864e5) + 1);
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── tiny synth sound engine (no audio files needed) ──
let AC = null;
const ac = () => { try { const c = AC || (AC = new (window.AudioContext || window.webkitAudioContext)()); if (c && c.state === "suspended") c.resume(); return c; } catch (e) { return null; } };
const env = (g, t, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d); };
function blip(f = 900, d = 0.05, v = 0.05) { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = f; o.connect(g); g.connect(c.destination); env(g, c.currentTime, v, d); o.start(); o.stop(c.currentTime + d + 0.02); }
function ding() { blip(1318, 0.12, 0.07); setTimeout(() => blip(1760, 0.18, 0.07), 90); }
function whistle() { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(); o.type = "triangle"; o.frequency.value = 2350; l.frequency.value = 28; lg.gain.value = 120; l.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(c.destination); const t = c.currentTime; g.gain.setValueAtTime(0.12, t); g.gain.setValueAtTime(0.12, t + 0.55); g.gain.exponentialRampToValueAtTime(0.001, t + 0.72); o.start(); l.start(); o.stop(t + 0.78); l.stop(t + 0.78); }
function roar() { const c = ac(); if (!c) return; const b = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate); const x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(500, c.currentTime); f.frequency.linearRampToValueAtTime(1200, c.currentTime + 0.5); f.Q.value = 0.8; const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.18); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1); s.connect(f); f.connect(g); g.connect(c.destination); s.start(); }
function groan() { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(220, c.currentTime); o.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.5); o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.08, 0.55); o.start(); o.stop(c.currentTime + 0.6); }
function fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 0.08), i * 140)); }

const FORMATIONS = {
  "4-3-3":   [["LW","ST","RW"], ["CM","CM","CM"], ["LB","CB","CB","RB"], ["GK"]],
  "4-4-2":   [["ST","ST"], ["LM","CM","CM","RM"], ["LB","CB","CB","RB"], ["GK"]],
  "4-2-3-1": [["ST"], ["CAM","CAM","CAM"], ["CDM","CDM"], ["LB","CB","CB","RB"], ["GK"]],
  "3-5-2":   [["ST","ST"], ["LWB","CM","CM","CM","RWB"], ["CB","CB","CB"], ["GK"]],
};

// which player positions can fill each slot label
const SLOT_ACCEPTS = {
  GK: ["GK"], CB: ["CB"], RB: ["RB","RWB"], LB: ["LB","LWB"],
  CM: ["CM","CDM","CAM"], CDM: ["CDM","CM"], CAM: ["CAM","CM"],
  RM: ["RM","RW"], LM: ["LM","LW"], RW: ["RW","RM"], LW: ["LW","LM"],
  RWB: ["RWB","RB","RM"], LWB: ["LWB","LB","LM"], ST: ["ST"],
};
const SLOT_CAT = (l) => l === "GK" ? "GK" : ["RB","CB","LB"].includes(l) ? "DEF" : ["RW","LW","ST"].includes(l) ? "ATT" : "MID";

const DIFFICULTY = {
  easy:    { name: "Casual",    mod: -3,  draw: 0.14 },
  classic: { name: "Classic",   mod: 0,   draw: 0.18 },
  legend:  { name: "Legendary", mod: 3.5, draw: 0.22 },
};

const STAGES = [
  { name: "Group · Match 1", diff: 79, ko: false },
  { name: "Group · Match 2", diff: 82, ko: false },
  { name: "Group · Match 3", diff: 84, ko: false },
  { name: "Round of 32",     diff: 85, ko: true },
  { name: "Round of 16",     diff: 87, ko: true },
  { name: "Quarter-final",   diff: 88, ko: true },
  { name: "Semi-final",      diff: 90, ko: true },
  { name: "Final",           diff: 92, ko: true },
];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const canFill = (slotLabel, posStr) => posStr.split("/").some((p) => SLOT_ACCEPTS[slotLabel]?.includes(p));

function buildSlots(formationKey) {
  let id = 0;
  return FORMATIONS[formationKey].map((row) => row.map((label) => ({ id: id++, label })));
}

function teamStrength(team) {
  const by = (c) => team.filter((x) => x.cat === c).map((x) => x.r);
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 75);
  const raw = avg(by("GK")) * 0.14 + avg(by("DEF")) * 0.30 + avg(by("MID")) * 0.28 + avg(by("ATT")) * 0.28;
  const weakest = Math.min(...team.map((x) => x.r));
  return raw - (raw - weakest) * 0.18;
}

function simMatch(team, stage, usedOpps, diffCfg) {
  const S = teamStrength(team);
  const opp = pick(OPPONENTS.filter((o) => !usedOpps.includes(o[1])));
  const diff = stage.diff + diffCfg.mod + rnd(-2.5, 2.5);
  const edge = S - diff;
  const pWin = 1 / (1 + Math.exp(-edge / 2.6));
  const roll = Math.random();
  let result;
  if (roll < pWin) result = "W";
  else if (roll < pWin + diffCfg.draw) result = "D";
  else result = "L";
  let gf, ga;
  if (result === "W") { gf = Math.max(1, Math.round(rnd(1, 2.4) + Math.max(0, edge) / 4)); ga = Math.random() < 0.55 ? 0 : 1; }
  else if (result === "D") { gf = Math.round(rnd(0, 2)); ga = gf; }
  else { ga = Math.max(1, Math.round(rnd(1, 2.2))); gf = Math.random() < 0.5 ? ga - 1 : Math.max(0, ga - 2); }
  let pens = null;
  if (stage.ko && result === "D") pens = Math.random() < 0.5 + Math.min(0.25, Math.max(-0.25, edge / 20)) ? "W" : "L";
  const pool = team.filter((p) => p.cat !== "GK");
  const weights = pool.map((p) => (p.cat === "ATT" ? p.r * 3 : p.cat === "MID" ? p.r * 1.4 : p.r * 0.3));
  const total = weights.reduce((s, v) => s + v, 0);
  const scorers = [];
  for (let i = 0; i < gf; i++) {
    let t = Math.random() * total, j = 0;
    while (t > weights[j]) { t -= weights[j]; j++; }
    scorers.push(pool[j].name);
  }
  return { stage: stage.name, ko: stage.ko, opp, gf, ga, result, pens, scorers };
}

function runTournament(team, diffCfg) {
  const matches = [];
  let eliminated = false;
  for (let i = 0; i < 8 && !eliminated; i++) {
    const m = simMatch(team, STAGES[i], matches.map((x) => x.opp[1]), diffCfg);
    matches.push(m);
    if (STAGES[i].ko && (m.result === "L" || m.pens === "L")) eliminated = true;
    if (matches.length === 3) {
      const pts = matches.reduce((s, x) => s + (x.result === "W" ? 3 : x.result === "D" ? 1 : 0), 0);
      if (pts <= 3 && Math.random() < 0.7) eliminated = true;
      else if (pts === 4 && Math.random() < 0.25) eliminated = true;
    }
  }
  return { matches, eliminated };
}

const freshP = () => ({ picks: {}, skips: 2, run: null, revealed: 0 });

export default function App() {
  const [phase, setPhase] = useState("home");
  const [eraMode, setEraMode] = useState("alltime");
  const [mode, setMode] = useState("solo"); // solo | duel | daily
  const duel = mode === "duel";
  const daily = mode === "daily";
  const [soundOn, setSoundOn] = useState(() => store.get("r80snd", true));
  const sndRef = useRef(soundOn);
  useEffect(() => { sndRef.current = soundOn; store.set("r80snd", soundOn); }, [soundOn]);
  const S = (fn, ...a) => { if (sndRef.current) try { fn(...a); } catch (e) {} };
  const [stats, setStats] = useState(() => store.get("r80stats", { plays: 0, crowns: 0, perfects: 0, best: 0, streak: 0, bestStreak: 0 }));
  const statsDone = useRef(false);
  const [spinCount, setSpinCount] = useState(0);
  const [formation, setFormation] = useState("4-3-3");
  const [difficulty, setDifficulty] = useState("classic");
  const [hardMode, setHardMode] = useState(false);
  const [P, setP] = useState([freshP(), freshP()]);
  const [nation, setNation] = useState(null);   // { team, flag, eras: [squad,…] }
  const [era, setEra] = useState(null);          // chosen squad
  const [pending, setPending] = useState(null);  // player awaiting slot choice
  const [spinning, setSpinning] = useState(false);
  const [spinFace, setSpinFace] = useState("🏆");
  const [copied, setCopied] = useState(false);
  const [autoSim, setAutoSim] = useState(false);
  const [live, setLive] = useState(null); // live match ticker state
  const [imgURL, setImgURL] = useState(null);
  const timers = useRef([]);

  const SQUADS = eraMode === "wc26" ? SQUADS_WC26 : SQUADS_ALLTIME;
  const NATIONS = React.useMemo(() => {
    const m = new Map();
    SQUADS.forEach((sq) => {
      if (!m.has(sq.team)) m.set(sq.team, { team: sq.team, flag: sq.flag, eras: [] });
      m.get(sq.team).eras.push(sq);
    });
    return [...m.values()];
  }, [SQUADS]);

  const slotRows = buildSlots(formation);
  const allSlots = slotRows.flat();
  const diffCfg = DIFFICULTY[difficulty];
  const players = duel ? [0, 1] : [0];
  const teamOf = (i) => Object.values(P[i].picks);
  const total = players.reduce((s, i) => s + teamOf(i).length, 0);
  const turn = duel ? total % 2 : 0;
  const draftDone = players.every((i) => teamOf(i).length === 11);
  const openSlots = (i) => allSlots.filter((s) => !P[i].picks[s.id]);
  const pickedKeys = new Set(players.flatMap((i) => teamOf(i).map((p) => p.name + p.year)));

  const eligibleIn = (sq) => sq.players.some(([n, pos]) => !pickedKeys.has(n + sq.year) && openSlots(turn).some((s) => canFill(s.label, pos)));
  const clearTimers = () => { timers.current.forEach(clearInterval); timers.current = []; };
  useEffect(() => clearTimers, []);

  const pickTarget = () => {
    if (daily) {
      for (let t = 0; t < NATIONS.length; t++) {
        const r = mulberry32(hash(DAY) + (spinCount + t) * 7919)();
        const n = NATIONS[Math.floor(r * NATIONS.length)];
        if (n.eras.some(eligibleIn)) return n;
      }
    }
    const viable = NATIONS.filter((n) => n.eras.some(eligibleIn));
    return viable.length ? pick(viable) : pick(NATIONS);
  };

  const doSpin = () => {
    if (spinning) return;
    setSpinning(true); setNation(null); setEra(null); setPending(null);
    const target = pickTarget();
    setSpinCount((c) => c + 1);
    const ticks = 24;
    let i = 0;
    const step = () => {
      i++;
      if (i >= ticks) {
        setSpinFace(target.flag);
        setNation(target);
        S(ding);
        const okEras = target.eras.filter(eligibleIn);
        if (okEras.length === 1) setEra(okEras[0]);
        setSpinning(false);
        return;
      }
      setSpinFace(NATIONS[Math.floor(Math.random() * NATIONS.length)].flag);
      S(blip, 450 + i * 22, 0.03, 0.035);
      const delay = 45 + 440 * Math.pow(i / ticks, 3); // fast → dramatic crawl
      timers.current.push(setTimeout(step, delay));
    };
    step();
  };

  const tryDraft = (name, pos, r) => {
    const slots = openSlots(turn).filter((s) => canFill(s.label, pos));
    if (!slots.length || !era) return;
    // unique labels: if all eligible open slots share one label, place immediately
    const labels = [...new Set(slots.map((s) => s.label))];
    if (labels.length === 1) place(name, pos, r, slots[0]);
    else setPending({ name, pos, r, slots });
  };

  const place = (name, pos, r, slot) => {
    const next = P.map((pl, i) => i === turn
      ? { ...pl, picks: { ...pl.picks, [slot.id]: { name, pos, r, cat: SLOT_CAT(slot.label), at: slot.label, flag: era.flag, team: era.team, year: era.year } } }
      : pl);
    setP(next); setNation(null); setEra(null); setPending(null);
  };

  const skip = () => {
    if (P[turn].skips <= 0 || spinning) return;
    setP(P.map((pl, i) => (i === turn ? { ...pl, skips: pl.skips - 1 } : pl)));
    doSpin();
  };

  const startSim = () => {
    setP(P.map((pl, i) => players.includes(i) ? { ...pl, run: runTournament(teamOf(i), diffCfg), revealed: 0 } : pl));
    setAutoSim(false); setImgURL(null); statsDone.current = false; setPhase("sim");
  };

  // ── live match ticker ──
  const fmtMin = (m) => (m > 90 ? `90+${Math.ceil(m - 90)}'` : `${Math.floor(m)}'`);
  const mkEvents = (m) => {
    const used = new Set();
    const rmin = () => { let v; do { v = 1 + Math.floor(Math.pow(Math.random(), 0.85) * 93); } while (used.has(v)); used.add(v); return v; };
    const ev = [];
    m.scorers.forEach((s) => ev.push({ min: rmin(), side: "us", who: s }));
    for (let i = 0; i < m.ga; i++) ev.push({ min: rmin(), side: "them" });
    return ev.sort((a, b) => a.min - b.min);
  };

  const finishLive = (pi) => {
    setP((s) => s.map((pl, i) => (i === pi ? { ...pl, revealed: pl.revealed + 1 } : pl)));
    setLive(null);
  };

  const startMatch = () => {
    if (live) return;
    const cand = players.filter((i) => P[i].run && P[i].revealed < P[i].run.matches.length);
    if (!cand.length) return;
    const pi = cand.sort((a, b) => P[a].revealed - P[b].revealed)[0]; // duel alternates naturally
    const m = P[pi].run.matches[P[pi].revealed];
    const events = mkEvents(m);
    const target = Math.max(90, ...events.map((e) => e.min + 1), 0);
    setLive({ pi, m, events, idx: 0, min: 0, gf: 0, ga: 0, target, phase: "play", flash: null });
    const t = setInterval(() => {
      setLive((lv) => {
        if (!lv || lv.phase !== "play") return lv;
        let { min, idx, gf, ga, flash } = lv;
        min += lv.target / 64; // ~3.2 seconds of football
        while (idx < lv.events.length && lv.events[idx].min <= min) {
          const e = lv.events[idx];
          if (e.side === "us") gf++; else ga++;
          flash = e; idx++;
        }
        if (min >= lv.target) {
          clearInterval(t);
          const wait = lv.m.pens ? 1700 : 700;
          const to = setTimeout(() => finishLive(lv.pi), wait);
          timers.current.push(to);
          return { ...lv, min: lv.target, idx, gf, ga, flash, phase: lv.m.pens ? "pens" : "ft" };
        }
        return { ...lv, min, idx, gf, ga, flash };
      });
    }, 50);
    timers.current.push(t);
  };

  // sim-all: chain matches automatically with a breath between them
  useEffect(() => {
    if (phase !== "sim" || !autoSim) return;
    const done = players.every((i) => P[i].run && P[i].revealed >= P[i].run.matches.length);
    if (done) { setAutoSim(false); return; }
    if (!live) {
      const t = setTimeout(startMatch, 800);
      timers.current.push(t);
      return () => clearTimeout(t);
    }
  }, [phase, autoSim, live, P]); // eslint-disable-line

  // ── sounds tied to the live ticker ──
  useEffect(() => { if (live?.flash && live.phase === "play") S(live.flash.side === "us" ? roar : groan); }, [live?.idx]); // eslint-disable-line
  useEffect(() => { if (live && (live.phase === "ft" || live.phase === "pens")) S(whistle); }, [live?.phase]); // eslint-disable-line

  // ── record stats + champion fanfare on result ──
  useEffect(() => {
    if (phase !== "result" || duel || statsDone.current || !P[0].run) return;
    statsDone.current = true;
    const ch = champion(0);
    if (ch) S(fanfare);
    setStats((s) => {
      const ns = {
        ...s,
        plays: s.plays + 1,
        crowns: s.crowns + (ch ? 1 : 0),
        perfects: s.perfects + (perfect(0) ? 1 : 0),
        best: Math.max(s.best, winsOf(0)),
        streak: ch ? s.streak + 1 : 0,
      };
      ns.bestStreak = Math.max(s.bestStreak || 0, ns.streak);
      store.set("r80stats", ns);
      return ns;
    });
  }, [phase]); // eslint-disable-line

  const allRevealed = players.every((i) => P[i].run && P[i].revealed >= P[i].run.matches.length);
  const champion = (i) => P[i].run && !P[i].run.eliminated && P[i].run.matches.length === 8;
  const winsOf = (i) => (P[i].run ? P[i].run.matches.filter((m) => m.result === "W").length : 0);
  const perfect = (i) => champion(i) && winsOf(i) === 8;
  const duelWinner = () => {
    if (!duel) return null;
    const score = (i) => (champion(i) ? 9 : P[i].run.matches.length) * 10000 + winsOf(i) * 100 + P[i].run.matches.reduce((s, m) => s + m.gf - m.ga, 0);
    const a = score(0), b = score(1);
    return a === b ? -1 : a > b ? 0 : 1;
  };

  const headline = (i) => perfect(i) ? "PERFECT 8–0" : champion(i) ? `World champions · ${winsOf(i)} wins` : `Out at the ${P[i].run.matches.at(-1)?.stage}`;
  const squaresOf = (i) => P[i].run.matches.map((m) => (m.result === "W" ? "🟩" : m.result === "D" ? "🟨" : "🟥")).join("");

  const shareText = () => {
    if (!duel) return `${SITE_NAME}${daily ? ` · Daily #${DAILY_NUM}` : ""} ⚽ ${diffCfg.name}${hardMode ? " · Hard" : ""} · ${formation}\n${headline(0)}\n${squaresOf(0)}\nCan you go 8-0?`;
    const w = duelWinner();
    return `${SITE_NAME} ⚽ 1v1 Duel\nP1 ${squaresOf(0)}\nP2 ${squaresOf(1)}\n${w === -1 ? "Dead heat!" : `Player ${w + 1} takes the crown 👑`}`;
  };
  const copyShare = async () => { try { await navigator.clipboard.writeText(shareText()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {} };

  // ── share-image generator (canvas → PNG) ──
  const makeImage = () => {
    const W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#155731"); g.addColorStop(0.5, "#0c331e"); g.addColorStop(1, "#06190f");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(242,239,229,.14)"; x.lineWidth = 3;
    x.strokeRect(40, 40, W - 80, H - 80);
    x.beginPath(); x.arc(W / 2, H / 2, 130, 0, 7); x.stroke();
    x.textAlign = "center";
    x.fillStyle = "#f2efe5"; x.font = "900 150px Arial Black, Arial";
    x.fillText("8", W / 2 - 95, 200); x.fillText("0", W / 2 + 95, 200);
    x.fillStyle = "#e8c547"; x.fillText("–", W / 2, 192);
    x.font = "600 34px Arial"; x.fillStyle = "#8fbc9c";
    x.fillText(`${diffCfg.name.toUpperCase()}${hardMode ? " · HARD MODE" : ""} · ${formation}`, W / 2, 258);
    const i0 = 0;
    x.fillStyle = perfect(i0) || champion(i0) ? "#e8c547" : "#e57382";
    x.font = "900 64px Arial Black, Arial";
    x.fillText(perfect(i0) ? "🏆 PERFECT 8–0 🏆" : champion(i0) ? "🏆 WORLD CHAMPIONS" : "KNOCKED OUT", W / 2, 350);
    if (!perfect(i0)) { x.font = "600 36px Arial"; x.fillStyle = "#9fc7ab"; x.fillText(headline(i0), W / 2, 402); }
    // result squares
    const ms = P[i0].run.matches, sq = 74, gap = 14, sx = W / 2 - (ms.length * (sq + gap) - gap) / 2;
    ms.forEach((m, k) => {
      x.fillStyle = m.result === "W" ? "#4caf6d" : m.result === "D" ? "#e8c547" : "#c8323e";
      if (x.roundRect) { x.beginPath(); x.roundRect(sx + k * (sq + gap), 432, sq, sq, 14); x.fill(); }
      else x.fillRect(sx + k * (sq + gap), 432, sq, sq);
    });
    // the XI
    x.font = "700 30px Arial"; x.textAlign = "left";
    const xi = allSlots.map((s) => ({ s, p: P[i0].picks[s.id] })).filter((e) => e.p);
    xi.forEach((e, k) => {
      const col = k < 6 ? 0 : 1, row = k % 6;
      const px = 110 + col * 470, py = 600 + row * 80;
      x.fillStyle = "#7fae8d"; x.font = "600 22px Arial"; x.fillText(e.s.label, px, py);
      x.fillStyle = "#f2efe5"; x.font = "700 30px Arial"; x.fillText(`${e.p.flag} ${e.p.name}`, px + 70, py);
      x.fillStyle = "#e8c547"; x.font = "700 26px Arial"; x.fillText(String(e.p.r), px + 380, py);
      x.fillStyle = "#5d8268"; x.font = "400 18px Arial"; x.fillText(`${e.p.team} '${String(e.p.year).slice(2)}`, px + 70, py + 26);
    });
    x.textAlign = "center"; x.fillStyle = "#8fbc9c"; x.font = "600 30px Arial";
    x.fillText("Can you go 8–0?  ·  " + SITE_NAME, W / 2, H - 80);
    setImgURL(c.toDataURL("image/png"));
  };

  const reset = () => { clearTimers(); setP([freshP(), freshP()]); setNation(null); setEra(null); setPending(null); setSpinning(false); setLive(null); setAutoSim(false); setImgURL(null); setSpinCount(0); statsDone.current = false; setPhase("home"); };

  const Chip = ({ active, onClick, children }) => <button className={"chip" + (active ? " on" : "")} onClick={onClick}>{children}</button>;

  const Pitch = ({ pi, small }) => (
    <div className={"pitch" + (small ? " sm" : "")}>
      <div className="pitch-lines" />
      {slotRows.map((row, ri) => (
        <div key={ri} className="prow">
          {row.map((s) => {
            const p = P[pi].picks[s.id];
            const hl = pending && pending.slots.some((ps) => ps.id === s.id);
            return (
              <div key={s.id} className={"slot" + (p ? " filled" : "") + (hl ? " hl" : "")}
                   onClick={() => hl && place(pending.name, pending.pos, pending.r, allSlots[s.id])}>
                <span className="sl">{s.label}</span>
                {p ? <span className="sn">{p.flag} {small ? p.name.split(" ").at(-1) : p.name}{!hardMode && <b className="sr">{p.r}</b>}</span>
                   : <span className="se">{hl ? "⬇" : "·"}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const MatchList = ({ pi }) => (
    <div className="mlist">
      {P[pi].run && P[pi].run.matches.slice(0, P[pi].revealed).map((m, i) => (
        <div key={i} className={"match " + m.result}>
          <div>
            <div className="m-stage">{m.stage}</div>
            <div className="m-opp">{m.opp[0]} {m.opp[1]}</div>
            {m.scorers.length > 0 && <div className="m-scorers">⚽ {m.scorers.join(", ")}</div>}
          </div>
          <div className="m-score">{m.gf}–{m.ga}{m.pens && <div className={"pens " + (m.pens === "W" ? "g" : "r")}>{m.pens === "W" ? "won pens" : "lost pens"}</div>}</div>
        </div>
      ))}
      {P[pi].run && P[pi].revealed >= P[pi].run.matches.length && P[pi].run.eliminated && <div className="elim">Eliminated — {P[pi].run.matches.at(-1).stage}</div>}
    </div>
  );

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="eyebrow">Unofficial fan draft game · 2026 format</div>
        <h1 className="logo">8<span>–</span>0</h1>
        <div className="tag">Eight games. Zero mercy.</div>

        {phase === "home" && (
          <>
            <div className="card">
              <p className="intro">Spin the wheel of nations, choose your era, and draft your XI position by position. Then survive the modern World Cup gauntlet — three group games and five knockout rounds. Win all eight to write history.</p>
              <div className="setrow"><span className="setlbl">Era</span>
                <Chip active={eraMode === "alltime"} onClick={() => setEraMode("alltime")}>All-time legends</Chip>
                <Chip active={eraMode === "wc26"} onClick={() => setEraMode("wc26")}>2026 · all 48 squads</Chip>
              </div>
              <div className="setrow"><span className="setlbl">Mode</span>
                <Chip active={mode === "solo"} onClick={() => setMode("solo")}>Solo run</Chip>
                <Chip active={mode === "duel"} onClick={() => setMode("duel")}>1v1 duel</Chip>
                <Chip active={mode === "daily"} onClick={() => setMode("daily")}>📅 Daily #{DAILY_NUM}</Chip>
              </div>
              <div className="setrow"><span className="setlbl">Formation</span>
                {Object.keys(FORMATIONS).map((f) => <Chip key={f} active={formation === f} onClick={() => setFormation(f)}>{f}</Chip>)}
              </div>
              <div className="setrow"><span className="setlbl">Difficulty</span>
                {Object.entries(DIFFICULTY).map(([k, v]) => <Chip key={k} active={difficulty === k} onClick={() => setDifficulty(k)}>{v.name}</Chip>)}
              </div>
              <div className="setrow"><span className="setlbl">Ratings</span>
                <Chip active={!hardMode} onClick={() => setHardMode(false)}>Visible</Chip>
                <Chip active={hardMode} onClick={() => setHardMode(true)}>Hidden (hard)</Chip>
              </div>
              <div className="setrow"><span className="setlbl">Sound</span>
                <Chip active={soundOn} onClick={() => setSoundOn(true)}>🔊 On</Chip>
                <Chip active={!soundOn} onClick={() => setSoundOn(false)}>🔇 Off</Chip>
              </div>
              <button className="btn gold big" onClick={() => setPhase("draft")}>Start the road to 8–0 →</button>
              {duel && <p className="hint">1v1 is pass-and-play: alternate spins on the same screen. Furthest run wins the crown.</p>}
              {daily && <p className="hint">📅 Daily challenge: everyone in the world gets the same wheel today. Compare your result!</p>}
            </div>
            <div className="statgrid">
              <div><b>{SQUADS_ALLTIME.length + SQUADS_WC26.length}</b><span>squads</span></div>
              <div><b>1950–2026</b><span>eras</span></div>
              <div><b>8</b><span>games to glory</span></div>
            </div>
            {stats.plays > 0 && (
              <div className="statgrid mystats">
                <div><b>🏆 {stats.crowns}</b><span>titles</span></div>
                <div><b>💎 {stats.perfects}</b><span>perfect 8–0s</span></div>
                <div><b>🔥 {stats.streak}</b><span>title streak</span></div>
                <div><b>{stats.best}W</b><span>best run</span></div>
              </div>
            )}
          </>
        )}

        {phase === "draft" && (
          <>
            <div className="meta">
              {duel && <span className={"turnbadge p" + turn}>Player {turn + 1} on the clock</span>}
              <span>Picks {teamOf(turn).length}/11</span>
              <span>Skips {P[turn].skips}</span>
              <span>{formation}</span>
            </div>
            <Pitch pi={turn} />
            {!draftDone && (
              <div className="card">
                {!nation && (
                  <div className="spinbox">
                    <div className={"spinface" + (spinning ? " whirl" : "")}>{spinning ? spinFace : "🏆"}</div>
                    <button className="btn gold" disabled={spinning} onClick={doSpin}>{spinning ? "Spinning…" : "Spin the wheel"}</button>
                  </div>
                )}
                {nation && !era && (
                  <>
                    <div className="squadhead"><span className="bigflag">{nation.flag}</span><span className="squadname">{nation.team}</span></div>
                    <p className="hint" style={{ marginTop: 0 }}>Choose an era:</p>
                    <div className="eras">
                      {nation.eras.map((sq) => (
                        <button key={sq.year} className="erabtn" disabled={!eligibleIn(sq)} onClick={() => setEra(sq)}>{sq.year}</button>
                      ))}
                    </div>
                    <button className="btn red slim" disabled={P[turn].skips <= 0} onClick={skip}>Skip nation ({P[turn].skips} left)</button>
                  </>
                )}
                {era && !pending && (
                  <>
                    <div className="squadhead"><span className="bigflag">{era.flag}</span><span className="squadname">{era.team} <em>{era.year}</em></span></div>
                    <div className="plist">
                      {era.players.map(([n, pos, r]) => {
                        const can = !pickedKeys.has(n + era.year) && openSlots(turn).some((s) => canFill(s.label, pos));
                        return (
                          <button key={n} className="pbtn" disabled={!can} onClick={() => tryDraft(n, pos, r)}>
                            <span>{n}<i className="pp">{pos}</i></span>{!hardMode && <b className="pr">{r}</b>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="row">
                      {nation.eras.length > 1 && <button className="btn ghost slim" onClick={() => setEra(null)}>← Eras</button>}
                      <button className="btn red slim" disabled={P[turn].skips <= 0} onClick={skip}>Skip ({P[turn].skips})</button>
                    </div>
                  </>
                )}
                {pending && (
                  <>
                    <div className="squadhead"><span className="squadname">{pending.name} <em>{pending.pos}</em></span></div>
                    <p className="hint" style={{ marginTop: 0 }}>Where should they line up? Tap a position:</p>
                    <div className="eras">
                      {[...new Map(pending.slots.map((s) => [s.label, s])).values()].map((s) => (
                        <button key={s.id} className="erabtn gold-b" onClick={() => place(pending.name, pending.pos, pending.r, s)}>{s.label}</button>
                      ))}
                    </div>
                    <button className="btn ghost slim" onClick={() => setPending(null)}>← Back to squad</button>
                  </>
                )}
              </div>
            )}
            {draftDone && <button className="btn gold big" onClick={startSim}>{duel ? "Both squads locked — to the tournament →" : "Squad complete — simulate the World Cup →"}</button>}
            {duel && !draftDone && <div className="duelmini"><Pitch pi={turn === 0 ? 1 : 0} small /></div>}
          </>
        )}

        {phase === "sim" && (
          <>
            {!allRevealed && !live && (
              <div className="row">
                <button className="btn ghost" disabled={autoSim} onClick={startMatch}>▶ Play match</button>
                <button className="btn gold" disabled={autoSim} onClick={() => setAutoSim(true)}>⚡ Simulate all</button>
              </div>
            )}
            {live && (
              <div className={"livecard" + (live.flash ? (live.flash.side === "us" ? " fus" : " fthem") : "")} key={"lv" + live.pi + P[live.pi].revealed}>
                <div className="lv-top">{duel ? `Player ${live.pi + 1} · ` : ""}{live.m.stage} · vs {live.m.opp[0]} {live.m.opp[1]}</div>
                <div className="lv-mid">
                  <span className="lv-score">{live.gf}<i>–</i>{live.ga}</span>
                  <span className={"lv-clock" + (live.phase !== "play" ? " ft" : "")}>{live.phase === "pens" ? "PENS" : live.phase === "ft" ? "FT" : fmtMin(live.min)}</span>
                </div>
                {live.flash && live.phase === "play" && (
                  <div className={"lv-goal " + (live.flash.side === "us" ? "g" : "r")} key={live.idx}>
                    ⚽ {fmtMin(live.flash.min)} {live.flash.side === "us" ? `${live.flash.who}!` : "They score…"}
                  </div>
                )}
                {live.phase === "pens" && <div className="lv-pens">Penalty shootout…</div>}
                {live.phase === "ft" && live.flash && <div className={"lv-goal " + (live.flash.side === "us" ? "g" : "r")}>Full time</div>}
              </div>
            )}
            <div className={duel ? "duelgrid" : ""}>
              {players.map((i) => (
                <div key={i}>
                  {duel && <div className={"pname p" + i}>Player {i + 1}</div>}
                  <MatchList pi={i} />
                </div>
              ))}
            </div>
            {allRevealed && <button className="btn gold big" onClick={() => setPhase("result")}>Final whistle — see result →</button>}
          </>
        )}

        {phase === "result" && (
          <>
            <div className="card center">
              {!duel ? (
                <>
                  {perfect(0) && <div className="bigresult gold-t">🏆 PERFECT 8–0 🏆</div>}
                  {champion(0) && !perfect(0) && <div className="bigresult gold-t">🏆 World champions</div>}
                  {!champion(0) && <div className="bigresult red-t">Knocked out</div>}
                  <p className="sub">{champion(0) ? (perfect(0) ? "Eight games. Eight wins. Football perfection." : `You lifted the trophy with ${winsOf(0)} wins — the perfect 8–0 escaped you.`) : `Your run ended at the ${P[0].run.matches.at(-1)?.stage}.`}</p>
                  <div className="emojis">{squaresOf(0)}</div>
                  <p className="hint">🔥 Title streak: {stats.streak} · Best run: {stats.best}W · Perfects: {stats.perfects}</p>
                </>
              ) : (
                <>
                  {duelWinner() === -1 ? <div className="bigresult gold-t">Dead heat</div> : <div className="bigresult gold-t">👑 Player {duelWinner() + 1} wins</div>}
                  {players.map((i) => <p key={i} className="sub"><b className={"pname-inline p" + i}>P{i + 1}</b> — {headline(i)} <span className="emojis sm">{squaresOf(i)}</span></p>)}
                </>
              )}
              <div className="row mt">
                <button className="btn ghost" onClick={copyShare}>{copied ? "Copied!" : "Copy share text"}</button>
                <button className="btn gold" onClick={reset}>Run it back</button>
              </div>
              {!duel && !imgURL && <button className="btn ghost" style={{ marginTop: 8 }} onClick={makeImage}>🖼 Generate share image</button>}
              {imgURL && (
                <div style={{ marginTop: 12 }}>
                  <img src={imgURL} alt="share card" style={{ width: "100%", borderRadius: 12, border: "1px solid #2c5a3c" }} />
                  <a className="coffee" style={{ marginTop: 10 }} href={imgURL} download="road-to-8-0.png">⬇ Download image</a>
                </div>
              )}
            </div>
            <div className="center"><a className="coffee" href={BMC_LINK} target="_blank" rel="noreferrer">☕ Enjoying the game? Buy me a coffee</a></div>
          </>
        )}

        <div className="footer">
          8–0 is an independent, fan-made game. It is not affiliated with, endorsed by, sponsored by, licensed by, or otherwise associated with FIFA, any national federation, confederation, club, competition, or governing body. Player names, national team names and tournament references are used descriptively. Ratings are an independent interpretation for entertainment purposes only. No official logos, emblems, kits, player images or other official branding are used.
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Barlow+Condensed:wght@400;600;700&display=swap');
*{box-sizing:border-box}
.app{min-height:100vh;background:radial-gradient(1100px 650px at 50% -8%,#155731 0%,#0c331e 48%,#06190f 100%);background-color:#06190f;color:#f2efe5;font-family:'Barlow Condensed',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;padding:0 12px 44px}
.wrap{width:100%;max-width:540px}
h1.logo{font-family:'Archivo Black',Arial,sans-serif;font-size:58px;line-height:1;margin:26px 0 2px;text-align:center;letter-spacing:-2px}
h1.logo span{color:#e8c547}
.tag{text-align:center;font-size:17px;letter-spacing:3px;text-transform:uppercase;color:#8fbc9c;margin-bottom:8px}
.eyebrow{text-align:center;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#5d8268;margin-top:22px}
.card{background:rgba(13,42,26,.85);border:1px solid #1d4a30;border-radius:16px;padding:16px;margin:12px 0;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.card.center,.center{text-align:center}
.intro{font-size:17px;line-height:1.45;margin:2px 0 14px;color:#d9e4d6}
.setrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:7px 0}
.setlbl{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6f9b7d;width:72px;flex:none}
.chip{font-family:inherit;font-size:15px;font-weight:600;color:#9fc7ab;background:#0a2416;border:1px solid #2c5a3c;border-radius:99px;padding:4px 12px;cursor:pointer}
.chip.on{background:#e8c547;border-color:#e8c547;color:#142b1c}
.btn{font-family:inherit;font-weight:700;font-size:17px;letter-spacing:1.2px;text-transform:uppercase;border:none;border-radius:11px;padding:12px 18px;cursor:pointer;width:100%;transition:transform .08s,filter .15s}
.btn:active{transform:scale(.985)}
.btn:hover:not(:disabled){filter:brightness(1.07)}
.btn:disabled{opacity:.4;cursor:default}
.btn.big{font-size:19px;margin-top:12px}
.btn.slim{margin-top:10px;padding:9px}
.gold{background:linear-gradient(180deg,#f0d36a,#dcb52e);color:#142b1c}
.ghost{background:transparent;color:#9fc7ab;border:1px solid #2c5a3c}
.red{background:#36141d;color:#ef9aa5;border:1px solid #6e2533}
.hint{font-size:14px;color:#8fbc9c;margin:10px 0 0;text-align:center}
.statgrid{display:flex;justify-content:space-around;text-align:center;background:rgba(13,42,26,.55);border:1px solid #1d4a30;border-radius:16px;padding:12px;margin:4px 0}
.statgrid b{display:block;font-family:'Archivo Black',Arial,sans-serif;font-size:21px;color:#e8c547}
.statgrid.mystats{margin-top:8px;border-color:#3a5e2b}
.statgrid span{font-size:13px;color:#8fbc9c;letter-spacing:1px;text-transform:uppercase}
.meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px;color:#9fc7ab;margin:8px 2px;flex-wrap:wrap}
.turnbadge{font-weight:700;font-size:14px;padding:2px 10px;border-radius:99px}
.turnbadge.p0{background:#1c3f63;color:#9cc7f0}.turnbadge.p1{background:#5a2a14;color:#f0bb9c}
.pname{font-weight:700;font-size:16px;letter-spacing:1px;margin:8px 0 2px}
.pname.p0,.pname-inline.p0{color:#9cc7f0}.pname.p1,.pname-inline.p1{color:#f0bb9c}
.pitch{position:relative;background:repeating-linear-gradient(180deg,#0f3d24 0 36px,#0d381f 36px 72px);border:2px solid #2c5a3c;border-radius:14px;padding:10px 6px 8px;overflow:hidden}
.pitch-lines{position:absolute;inset:8px;border:1px solid rgba(242,239,229,.16);border-radius:8px;pointer-events:none}
.pitch-lines:after{content:"";position:absolute;left:50%;top:50%;width:64px;height:64px;border:1px solid rgba(242,239,229,.14);border-radius:50%;transform:translate(-50%,-50%)}
.pitch.sm{transform:scale(.92);opacity:.85}
.prow{display:flex;justify-content:center;gap:6px;margin:5px 0;position:relative;z-index:1}
.slot{flex:0 1 96px;min-height:38px;background:rgba(6,22,13,.6);border:1px dashed #3c6b4c;border-radius:8px;padding:3px 5px;text-align:center;display:flex;flex-direction:column;justify-content:center}
.slot.filled{border-style:solid;border-color:#caa838;background:rgba(22,48,30,.95)}
.slot.hl{border-style:solid;border-color:#e8c547;background:rgba(232,197,71,.18);cursor:pointer;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,197,71,.35)}50%{box-shadow:0 0 0 6px rgba(232,197,71,0)}}
.sl{font-size:9px;letter-spacing:2px;color:#7fae8d}
.sn{font-size:13px;font-weight:700;line-height:1.1}
.sr{font-size:11px;color:#e8c547;margin-left:4px}
.se{font-size:14px;color:#3c6b4c}
.spinbox{text-align:center}
.spinface{font-size:64px;margin:2px 0 6px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.spinface.whirl{animation:wobble .18s infinite}
@keyframes wobble{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.06) rotate(2deg)}}
.squadhead .bigflag{animation:landpop .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes landpop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}
.livecard{background:linear-gradient(180deg,#0e2f1c,#0a2415);border:1px solid #2c5a3c;border-radius:14px;padding:14px 16px;margin:10px 0;text-align:center;transition:box-shadow .2s}
.livecard.fus{box-shadow:0 0 0 2px #4caf6d,0 0 26px rgba(76,175,109,.45)}
.livecard.fthem{box-shadow:0 0 0 2px #c8323e,0 0 26px rgba(200,50,62,.45)}
.lv-top{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#8fbc9c}
.lv-mid{display:flex;align-items:baseline;justify-content:center;gap:18px;margin:4px 0}
.lv-score{font-family:'Archivo Black',Arial,sans-serif;font-size:52px;line-height:1}
.lv-score i{color:#e8c547;font-style:normal}
.lv-clock{font-family:'Archivo Black',Arial,sans-serif;font-size:24px;color:#e8c547;min-width:74px;text-align:left;font-variant-numeric:tabular-nums}
.lv-clock.ft{color:#9fc7ab}
.lv-goal{font-size:17px;font-weight:700;animation:goalpop .4s cubic-bezier(.2,1.5,.4,1)}
.lv-goal.g{color:#6fdc94}.lv-goal.r{color:#ef8a96}
@keyframes goalpop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
.lv-pens{font-size:16px;font-weight:700;color:#e8c547;letter-spacing:2px;animation:blink 1s infinite}
@keyframes blink{50%{opacity:.35}}
.squadhead{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px}
.bigflag{font-size:40px}
.squadname{font-family:'Archivo Black',Arial,sans-serif;font-size:20px}
.squadname em{color:#e8c547;font-style:normal}
.eras{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:8px 0}
.erabtn{font-family:'Archivo Black',Arial,sans-serif;font-size:18px;color:#f2efe5;background:#11341f;border:1px solid #2c5a3c;border-radius:10px;padding:10px 18px;cursor:pointer}
.erabtn:hover:not(:disabled){border-color:#e8c547}
.erabtn:disabled{opacity:.3;cursor:default}
.erabtn.gold-b{background:linear-gradient(180deg,#f0d36a,#dcb52e);color:#142b1c;border:none}
.plist{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pbtn{display:flex;justify-content:space-between;align-items:center;background:#11341f;border:1px solid #2c5a3c;border-radius:8px;padding:7px 9px;color:#f2efe5;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-align:left}
.pbtn:hover:not(:disabled){border-color:#e8c547}
.pbtn:disabled{opacity:.3;cursor:default}
.pp{font-size:11px;color:#7fae8d;letter-spacing:1px;margin-left:6px;font-style:normal}
.pr{color:#e8c547;margin-left:8px}
.row{display:flex;gap:8px;margin:10px 0 4px}
.mt{margin-top:14px}
.duelgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.duelmini{margin-top:10px}
.mlist{margin-top:6px}
.match{display:flex;align-items:center;justify-content:space-between;background:rgba(13,42,26,.85);border:1px solid #1d4a30;border-left:4px solid #555;border-radius:10px;padding:8px 10px;margin:6px 0;animation:pop .45s ease}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.match.W{border-left-color:#4caf6d}.match.D{border-left-color:#e8c547}.match.L{border-left-color:#c8323e}
.m-stage{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7fae8d}
.m-opp{font-size:16px;font-weight:700}
.m-scorers{font-size:11px;color:#9fc7ab}
.m-score{font-family:'Archivo Black',Arial,sans-serif;font-size:20px;text-align:right;min-width:58px}
.pens{font-size:10px;font-family:'Barlow Condensed',sans-serif}.pens.g{color:#4caf6d}.pens.r{color:#e57382}
.elim{text-align:center;font-weight:700;color:#e57382;letter-spacing:1px;margin:8px 0;font-size:15px}
.bigresult{font-family:'Archivo Black',Arial,sans-serif;font-size:34px;margin:6px 0;line-height:1.1}
.gold-t{color:#e8c547}.red-t{color:#e57382}
.sub{font-size:17px;color:#9fc7ab;margin:6px 0}
.emojis{font-size:26px;letter-spacing:3px}.emojis.sm{font-size:16px;letter-spacing:1px}
.coffee{display:inline-block;margin-top:8px;background:linear-gradient(180deg,#f0d36a,#dcb52e);color:#142b1c;font-weight:700;font-size:15px;padding:9px 16px;border-radius:10px;text-decoration:none}
.footer{font-size:11px;color:#54775f;text-align:center;margin-top:28px;line-height:1.5}
@media(max-width:480px){h1.logo{font-size:48px}.slot{flex-basis:21%}.duelgrid{grid-template-columns:1fr}.setlbl{width:100%}}
`;
