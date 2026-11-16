// Hypothèses de démonstration uniquement. À remplacer après validation terrain.
window.CHAMS_CONFIG = {
  madPerKwh: 1.35,
  annualKwhPerKwp: 1650,
  installedMadPerKwp: { low: 8500, high: 12500 },
  selfConsumption: { day: 0.78, mixed: 0.58, night: 0.34 },
  roofAreaPerKwp: 7,
  designReserve: 0.88,
  minSystemKwp: 2,
  maxSystemKwp: 500,
  uncertainty: { normal: 0.12, wide: 0.24 }
};
