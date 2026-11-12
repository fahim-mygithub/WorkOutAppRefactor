import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT, READ_MACHINE_SYSTEM_PROMPT } from './prompts';

describe('CHAT_SYSTEM_PROMPT', () => {
  it('pairs an ongoing swap of a tracked lift with a benchmark update', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      "When you propose swapExercise with scope 'ongoing' for a tracked lift, also propose updateBenchmark with a realistic starting benchmark for the new exercise.",
    );
  });

  it('lets the pain rule override the missed-rep load rules', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      '- Pain that sounds like injury overrides the rules above: stop that exercise, suggest seeing a professional, and give no load advice. You may propose swapExercise to a pain-free alternative without a weight.',
    );
    // The pain rule comes after every load rule it overrides.
    expect(CHAT_SYSTEM_PROMPT.indexOf('Pain that sounds like injury')).toBeGreaterThan(
      CHAT_SYSTEM_PROMPT.indexOf('Cannot do the exercise at all'),
    );
  });

  it('points swapExercise at the per-exercise alternatives in the context', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      "For swapExercise, use a name from that exercise's `alternatives` in the context when one fits.",
    );
  });
});

describe('CHAT_SYSTEM_PROMPT history and past workouts', () => {
  it('tells the model it can read the whole history using read tools', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('list_history');
    expect(CHAT_SYSTEM_PROMPT).toContain('get_history_entry');
    expect(CHAT_SYSTEM_PROMPT).toContain('list_workouts');
    expect(CHAT_SYSTEM_PROMPT).toContain('get_workout');
  });

  it('instructs checking actual history and counts before answering', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      'ALWAYS check history and verify actual counts with tools before answering rather than guessing or assuming.',
    );
  });

  it('explains dictating and editing past workouts with logPastWorkout and editPastWorkout', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('logPastWorkout');
    expect(CHAT_SYSTEM_PROMPT).toContain('editPastWorkout');
    expect(CHAT_SYSTEM_PROMPT).toContain('Ask for missing dates or weights rather than guessing.');
    expect(CHAT_SYSTEM_PROMPT).toContain('Both logPastWorkout and editPastWorkout ask the lifter first.');
  });
});

describe('CHAT_SYSTEM_PROMPT build and plan tools', () => {
  it('names every new tool and says they ask first', () => {
    for (const tool of ['createWorkout', 'updateWorkout', 'planWorkout', 'updateProfile', 'addExercise']) {
      expect(CHAT_SYSTEM_PROMPT).toContain(tool);
    }
    expect(CHAT_SYSTEM_PROMPT).toContain('All of these ask the lifter first.');
  });
  it('keeps updateProfile to display and training fields', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('updateProfile changes only the display name and training preferences');
  });
  it('turns a machine photo into an addExercise proposal', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('photo of a machine');
  });
});

describe('CHAT_SYSTEM_PROMPT live workout editing tools', () => {
  it('names every live edit tool and says when to use each in one line', () => {
    for (const tool of ['addSets', 'removeOpenSets', 'addExerciseToWorkout', 'removeExerciseFromWorkout', 'setExerciseNote']) {
      expect(CHAT_SYSTEM_PROMPT).toContain(tool);
    }
    expect(CHAT_SYSTEM_PROMPT).toContain('addSets, removeOpenSets and setExerciseNote apply at once (the lifter can Undo)');
    expect(CHAT_SYSTEM_PROMPT).toContain('addExerciseToWorkout, removeExerciseFromWorkout');
  });
});

describe('READ_MACHINE_SYSTEM_PROMPT', () => {
  it('answers with submitMachine and never invents a brand-specific name it cannot read', () => {
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('submitMachine');
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('setupCues');
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('defaultSets');
  });
});

describe('CHAT_SYSTEM_PROMPT app-control tools', () => {
  const line = (tool: string) => CHAT_SYSTEM_PROMPT.split('\n').filter((l) => l.startsWith(`- ${tool}:`));
  it('gives each new tool one line on when to use it', () => {
    for (const tool of ['openTab', 'startWorkout', 'loadIntoBuild']) expect(line(tool)).toHaveLength(1);
    expect(line('startWorkout')[0]).toContain('overrides');
    expect(line('startWorkout')[0]).toContain('Asks the lifter first.');
    expect(line('loadIntoBuild')[0]).toContain('it never saves');
    expect(line('openTab')[0]).toContain('workout only while a workout is in progress');
  });
  it('loads workouts through tools, never by describing taps', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      'To load a workout for the lifter, use startWorkout (or loadIntoBuild to review first); never describe tapping buttons yourself.',
    );
  });
  it('opens the workout tab after a live edit only when the lifter is elsewhere', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("After a live edit, call openTab with tab workout only when the context's `tab` is not already workout.");
  });
});

describe('CHAT_SYSTEM_PROMPT screen awareness', () => {
  const line = (tool: string) => CHAT_SYSTEM_PROMPT.split('\n').filter((l) => l.startsWith(`- ${tool}:`));
  it('answers what is on screen from the screen block, without tools', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('`screen`');
    expect(CHAT_SYSTEM_PROMPT).toContain('without tools');
  });
  it('gives each Build edit tool a line, scoped to the Build tab', () => {
    expect(line('setBuildName')).toHaveLength(1);
    expect(line('editBuildExercise')).toHaveLength(1);
    expect(line('addBuildExercise / removeBuildExercise')).toHaveLength(1);
    expect(CHAT_SYSTEM_PROMPT).toContain("only while the context's `tab` is build");
    expect(CHAT_SYSTEM_PROMPT).toContain('loadIntoBuild replaces all of it');
  });
  it('keeps the live-workout tools for the workout tab', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('Active workout editing:');
    expect(line('addSets')).toHaveLength(1);
  });
  it('stays byte-stable: no per-request values in the prompt', () => {
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
