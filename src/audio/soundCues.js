const ATTACK_SOUNDS = {
  '1H_Melee_Attack_Slice_Diagonal': 'swing1',
  '1H_Melee_Attack_Slice_Horizontal': 'swing2',
  '1H_Melee_Attack_Chop': 'swing3',
};

const EVENT_SOUNDS = {
  beastHit: { name: 'hit', group: 'beast' },
  playerHit: { name: 'hurt', group: 'player' },
  stagger: { name: 'stagger', group: 'beast' },
  enraged: { name: 'enrage', group: 'beast' },
  won: { name: 'win', group: 'ui' },
  lost: { name: 'lose', group: 'ui' },
};

const STRIKE_SOUNDS = {
  slam: 'slam',
  charge: 'charge',
  spin: 'spin',
  rain: 'crystal',
};

const WALK_STEP_INTERVAL = 0.5;
const RUN_STEP_INTERVAL = 0.32;
const WALK_SPEED = 3;

export function createSoundCues() {
  let stepTime = 0;

  function reset() {
    stepTime = 0;
  }

  function update(dt, prev, next, playerPos) {
    const cues = [];
    const addedNames = new Set();

    function add(name, group) {
      if (addedNames.has(name)) return;

      const cue = { name, group };
      if (group === 'beast') {
        cue.distance = Math.hypot(
          next.beast.position.x - playerPos.x,
          next.beast.position.z - playerPos.z,
        );
      }

      addedNames.add(name);
      cues.push(cue);
    }

    if (prev !== null) {
      const animationName = next.player.animation.name;
      const swing = ATTACK_SOUNDS[animationName];
      if (swing && prev.player.animation.name !== animationName) {
        add(swing, 'player');
      }

      if (next.player.mode === 'dodge' && prev.player.mode !== 'dodge') {
        add('dodge', 'player');
      }

      for (const event of next.events) {
        const sound = EVENT_SOUNDS[event.type];
        if (sound) add(sound.name, sound.group);
      }

      if (next.beast.phase === 'telegraph' && prev.beast.phase !== 'telegraph') {
        add('warn', 'beast');
      }

      const strike = STRIKE_SOUNDS[next.beast.strikeKind];
      if (strike) add(strike, 'beast');

      if (next.beast.phase === 'dead' && prev.beast.phase !== 'dead') {
        add('shatter', 'beast');
      }
    }

    const moving =
      next.player.mode === 'free' &&
      next.player.move.speed > 0;

    if (!moving) {
      stepTime = 0;
    } else {
      const interval =
        next.player.move.speed <= WALK_SPEED
          ? WALK_STEP_INTERVAL
          : RUN_STEP_INTERVAL;

      if (Number.isFinite(dt) && dt > 0) stepTime += dt;

      if (stepTime >= interval) {
        stepTime %= interval;
        add('step', 'player');
      }
    }

    return cues;
  }

  return { update, reset };
}
