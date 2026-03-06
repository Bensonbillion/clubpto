let _simulationMode = false;

export function isSimulationMode(): boolean {
  return _simulationMode;
}

export function setSimulationMode(enabled: boolean): void {
  _simulationMode = enabled;
}
