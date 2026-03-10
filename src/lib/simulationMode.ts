let _simulationMode = false;
let _practiceMode = false;

export function isSimulationMode(): boolean {
  return _simulationMode;
}

export function setSimulationMode(enabled: boolean): void {
  _simulationMode = enabled;
}

/** Practice mode: state syncs across devices via Supabase, but no leaderboard points are awarded. */
export function isPracticeMode(): boolean {
  return _practiceMode;
}

export function setPracticeMode(enabled: boolean): void {
  _practiceMode = enabled;
}
