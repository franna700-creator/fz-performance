export const ADAPTIVE_LANES = Object.freeze(['ABSORB', 'MAINTAIN', 'ADAPT']);

export const ADAPTIVE_LANE_DEFINITIONS = Object.freeze({
  ABSORB: Object.freeze({
    objective: 'Protect recovery while preserving useful movement and aerobic continuity.',
    typicalCost: 'LOW',
    principle: 'Low-cost aerobic or recovery-oriented work. The goal is absorption, not a hidden quality session.'
  }),
  MAINTAIN: Object.freeze({
    objective: 'Preserve current capability without creating a material new recovery burden.',
    typicalCost: 'LOW_TO_MODERATE',
    principle: 'Technique, strength maintenance, steady aerobic work or controlled mixed work that protects the next key adaptation opportunity.'
  }),
  ADAPT: Object.freeze({
    objective: 'Create a deliberate adaptation stimulus against the current priority or measurement gap.',
    typicalCost: 'MODERATE_TO_HIGH',
    principle: 'Quality, race-specific or targeted capacity work. Higher intensity may be appropriate, but harder is not the definition; useful adaptation is.'
  })
});

export function isAdaptiveLane(value) {
  return ADAPTIVE_LANES.includes(String(value || '').toUpperCase());
}
