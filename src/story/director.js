// 第一章の進行役（three.js も DOM も使わない）。
// 場所に入った・調べた・敵に気づかれた・敵を倒した、という知らせを受けて、台本（script.js）の場面を流す。
// 場面の結果（印・段階・復帰地点）は progress に保存し、字幕・目的・描画への合図を返す。
import { SCENES, OBJECTIVES } from './script.js';

const LINE_BASE = 1.4;
const LINE_PER_CHAR = 0.09;
const LINE_MIN = 2.2;

// タップで送る場面。危険の知らせでも割り込まない
const BLOCKING_SCENES = new Set(['wake', 'memory']);
const lineSeconds = (text) => Math.max(LINE_MIN, LINE_BASE + LINE_PER_CHAR * text.length);
const PHASE_ORDER = ['TITLE', 'PROLOGUE', 'FOREST', 'CHAPEL_APPROACH', 'CHAPEL_INTERIOR', 'CHAPTER_COMPLETE', 'CRYSTAL_BATTLE'];
const atLeast = (progress, phase) => PHASE_ORDER.indexOf(progress.phase()) >= PHASE_ORDER.indexOf(phase);

// 保存から再開したときの目的
export function objectiveFor(progress) {
  const phase = progress.phase();
  if (phase === 'PROLOGUE') return null;
  if (phase === 'CHAPTER_COMPLETE' || phase === 'CRYSTAL_BATTLE') return OBJECTIVES.next;
  if (phase === 'CHAPEL_INTERIOR') return progress.flag('memorySeen') ? OBJECTIVES.altar : OBJECTIVES.mural;
  if (phase === 'CHAPEL_APPROACH') return OBJECTIVES.enterChapel;
  if (progress.flag('gateOpen')) return OBJECTIVES.toChapel;
  if (progress.flag('gateInspected')) return OBJECTIVES.winch;
  if (progress.seen('bridgeGone')) return OBJECTIVES.eastGate;
  if (progress.seen('plaza')) return OBJECTIVES.gatehouse;
  return OBJECTIVES.forest;
}

// 今、調べられる物
export function interactablesFor(progress) {
  const list = [];
  if (!progress.flag('flowers')) list.push('flowers');
  if (!progress.seen('memorial')) list.push('memorial');
  if (!progress.flag('gateOpen')) list.push('gate', 'lever');
  if (!progress.flag('winchFreed')) list.push('winch');
  if (atLeast(progress, 'CHAPEL_INTERIOR') && !progress.flag('memorySeen')) list.push('mural');
  if (progress.flag('memorySeen') && !atLeast(progress, 'CHAPTER_COMPLETE')) list.push('altar');
  if (atLeast(progress, 'CHAPTER_COMPLETE')) list.push('pilgrimPath');
  return list;
}

export function createDirector(progress, { scenes = SCENES } = {}) {
  let current = null;   // { id, steps, index, timer }
  let queue = [];
  let subtitle = null;
  let subtitleLeft = 0;
  let waitingTap = false;
  let objective = null;
  let control = true;
  let actions = [];

  const active = (id) => current?.id === id || queue.some((scene) => scene.id === id);

  // once の場面は、最後まで流れたときに「見た」と記録する（途中で物語を離れても、もう一度起こせる）
  // urgent：今の会話より先に流す。resume が false なら、割り込まれた会話は結果だけ確定して終える
  function play(id, { once = true, urgent = false, resume = true } = {}) {
    if (active(id)) return;
    if (once && progress.seen(id)) return;
    const scene = { id, steps: scenes[id], index: 0, timer: 0, once };
    if (urgent) {
      // タップ待ちの場面（目覚め・記憶）は止めず、その直後に流す
      if (current && BLOCKING_SCENES.has(current.id)) {
        queue.unshift(scene);
        return;
      }
      // 危険の知らせ：今の場面を一旦止めて、先に流す。止めた場面は、その行の頭から出し直す
      if (current && resume) {
        current.timer = 0;
        queue.unshift(current);
      } else if (current) {
        flush(current);
      }
      current = scene;
      subtitle = null;
      waitingTap = false;
      return;
    }
    if (current) queue.push(scene);
    else current = scene;
  }

  // 字幕以外の手順を、すぐに実行する
  function apply(step) {
    // 目的は、いつも今の進み具合から決める（後から流れた古い場面に上書きされないように）
    // 目的の手順は場面の「結果」：ここで場面を見たことにして、目的を決め直す
    if (step.objective !== undefined) {
      if (current?.once) progress.markSeen(current.id);
      objective = objectiveFor(progress);
    }
    if (step.set) progress.set(step.set);
    if (step.phase) progress.advance(step.phase);
    if (step.checkpoint) progress.reach(step.checkpoint);
    if (step.toast) actions.push(`toast:${step.toast}`);
    if (step.action) {
      if (step.action === 'control') control = true;
      actions.push(step.action);
    }
  }

  function lineOf(step) {
    if (step.say) return step.say;
    if (step.sayIf) return progress.flag(step.sayIf.flag) ? step.sayIf.yes : step.sayIf.no;
    return null;
  }

  // 今の場面を1手ずつ進める
  function advanceScene(dt, signals) {
    while (current) {
      const step = current.steps[current.index];
      if (!step) {
        if (current.once) progress.markSeen(current.id);
        current = queue.shift() ?? null;
        continue;
      }

      const line = lineOf(step);
      if (line) {
        if (current.timer === 0) {
          subtitle = { speaker: line[0], text: line[1] };
          subtitleLeft = lineSeconds(line[1]);
          waitingTap = Boolean(step.block);
        }
        current.timer += dt;
        if (step.block) {
          if (!signals.advance || current.timer <= dt) return;
        } else if (current.timer < lineSeconds(line[1])) {
          return;
        }
        // 送った字幕は、次の行が出るまで残さない（block の行）／自然に消えるまで残す（自動の行）
        if (step.block) subtitle = null;
        waitingTap = false;
        current.index += 1;
        current.timer = 0;
        continue;
      }

      if (step.wait !== undefined) {
        current.timer += dt;
        if (current.timer < step.wait) return;
        current.index += 1;
        current.timer = 0;
        continue;
      }

      apply(step);
      current.index += 1;
      current.timer = 0;
    }
  }

  // 記憶のスキップ：label 'memoryEnd' の手順まで、字幕を飛ばして進める
  function skipMemory() {
    if (current?.id !== 'memory') return;
    const end = current.steps.findIndex((step) => step.label === 'memoryEnd');
    if (end < 0 || current.index >= end) return;
    current.index = end;
    current.timer = 0;
    subtitle = null;
    waitingTap = false;
  }

  // 場面の残りを、字幕と間を飛ばして結果だけ実行する（倒れて復帰するとき）
  function flush(scene) {
    for (let i = scene.index; i < scene.steps.length; i++) {
      const step = scene.steps[i];
      if (!lineOf(step) && step.wait === undefined && step.action !== 'wakeIntro' && step.action !== 'lookAround') apply(step);
    }
    if (scene.once) progress.markSeen(scene.id);
  }

  function react(signals) {
    for (const zone of signals.zones) {
      if (zone === 'plaza' && !progress.seen('bridgeGone')) play('plaza');
      if (zone === 'overlook') play('bridgeGone');
      if (zone === 'chapelFront' && progress.flag('gateOpen')) play('chapelArrive');
      if (zone === 'nave' && atLeast(progress, 'CHAPEL_APPROACH')) play('nave');
    }
    for (const id of signals.noticed) {
      if (id === 'guard-2' || id === 'guard-3') play('warnTwo', { urgent: true });
    }
    for (const id of signals.defeated) {
      progress.defeat(id);
      if (id === 'guard-1') play('afterFirstFight');
    }

    const id = signals.interact;
    if (!id || !interactablesFor(progress).includes(id)) return;
    // 調べたときの反応は、エリアの話より先に出す（タップ待ちの場面には割り込まない）
    const now = { urgent: true, resume: false };
    if (id === 'flowers') play('flowers', now);
    if (id === 'memorial') play('memorial', now);
    if (id === 'gate') play('gateLocked', { ...now, once: false });
    if (id === 'winch') play('winchJammed', now);
    if (id === 'lever') {
      if (progress.flag('winchFreed')) play('leverPulled', now);
      else play('leverStuck', { ...now, once: false });
    }
    if (id === 'mural') play('memory', now);
    if (id === 'altar') play('altar', now);
    if (id === 'pilgrimPath') actions.push('toCrystal');
  }

  // 記憶の場面のうち、タップで送る部分（memoryEnd の手前まで）にいるか
  function inMemoryPart() {
    if (current?.id !== 'memory') return false;
    const end = current.steps.findIndex((step) => step.label === 'memoryEnd');
    return current.index < end;
  }

  function output() {
    const memory = inMemoryPart();
    const out = {
      subtitle,
      waitingTap,
      objective,
      control,
      blocking: waitingTap || memory || (current?.id === 'wake' && !control),
      inMemory: memory,
      actions,
      interactables: interactablesFor(progress),
    };
    actions = [];
    return out;
  }

  // 物語の始まり（はじめて／途中から）
  function begin() {
    current = null;
    queue = [];
    subtitle = null;
    waitingTap = false;
    objective = objectiveFor(progress);
    control = true;
    if (progress.phase() === 'PROLOGUE' && !progress.seen('wake')) {
      control = false;
      play('wake');
    }
    return output();
  }

  // signals = { zones: [id], interact: id | null, noticed: [id], defeated: [id], advance: bool, skip: bool }
  function update(dt, signals) {
    react(signals);
    if (signals.skip) skipMemory();
    advanceScene(dt, signals);
    // 自動の字幕は、読み終わる時間がたったら消す
    if (subtitle && !waitingTap) {
      subtitleLeft -= dt;
      if (subtitleLeft <= 0 && !lineOf(current?.steps[current.index] ?? {})) subtitle = null;
    }
    return output();
  }

  // 倒れて復帰点へ戻るとき：流れている場面の結果だけを確定させ、字幕を消す
  function respawn() {
    if (current) flush(current);
    for (const scene of queue) flush(scene);
    current = null;
    queue = [];
    subtitle = null;
    waitingTap = false;
    control = true;
    objective = objectiveFor(progress);
    actions = [];
  }

  return { begin, update, respawn, objective: () => objective };
}
