export const MEASUREMENT_PRIORITY_BY_LANE = Object.freeze({
  ABSORB:'LOW',
  MAINTAIN:'HIGH',
  ADAPT:'VERY_HIGH'
});

export const COMPARISON_CLASSES = Object.freeze(['BENCHMARK_EXACT','FAMILY_COMPARABLE','TRAINING_ONLY']);

function family(id,config={}){
  return Object.freeze({
    protocolFamilyId:id,
    protocolVersion:config.protocolVersion||'1.0',
    lane:config.lane,
    measurementPriority:config.measurementPriority||MEASUREMENT_PRIORITY_BY_LANE[config.lane]||'LOW',
    prescriptionLevel:config.prescriptionLevel||'STRUCTURED',
    defaultComparisonClass:config.defaultComparisonClass||'FAMILY_COMPARABLE',
    capabilityQuestion:config.capabilityQuestion||null,
    optionKeys:Object.freeze(config.optionKeys||[]),
    benchmarkInvariants:Object.freeze(config.benchmarkInvariants||[]),
    comparisonMetrics:Object.freeze(config.comparisonMetrics||[]),
    requiredCapture:Object.freeze(config.requiredCapture||[]),
    notes:Object.freeze(config.notes||[])
  });
}

export const SESSION_PROTOCOL_FAMILIES = Object.freeze({
  STEADY_AEROBIC_EFFICIENCY: family('STEADY_AEROBIC_EFFICIENCY',{
    lane:'MAINTAIN',optionKeys:['steady-aerobic'],prescriptionLevel:'STRUCTURED',
    capabilityQuestion:'Is controlled aerobic and running efficiency being preserved at a stable internal cost?',
    benchmarkInvariants:['modality','routeOrTreadmillAssumption','durationBand','intensityAnchor','warmupStandard'],
    comparisonMetrics:['paceOrPower','avgHeartRate','heartRateDrift','cadenceWhenReliable','sessionRpe'],
    requiredCapture:['duration','distanceOrWork','avgHeartRate','sessionRpe','routeOrMachineContext']
  }),
  STRENGTH_RESERVE_MAINTENANCE: family('STRENGTH_RESERVE_MAINTENANCE',{
    lane:'MAINTAIN',optionKeys:['strength-maintenance'],prescriptionLevel:'STRUCTURED',
    capabilityQuestion:'Is useful strength reserve being preserved without accumulating unnecessary recovery cost?',
    benchmarkInvariants:['movementIdentity','workingSetStructure','restRule','rirStandard','techniqueStandard'],
    comparisonMetrics:['load','reps','rir','completedSets','painOrLocalLimiter'],
    requiredCapture:['movement','load','reps','rir','rest','technicalDeviation','painOrLimiter']
  }),
  HYBRID_TRANSITION_ECONOMY: family('HYBRID_TRANSITION_ECONOMY',{
    lane:'MAINTAIN',optionKeys:['hybrid-technique'],prescriptionLevel:'STRUCTURED',
    capabilityQuestion:'Is hybrid sequencing and transition economy being preserved at a deliberately controlled cost?',
    benchmarkInvariants:['stationSequence','stationStandard','transitionRule','runOrErgControlAnchor'],
    comparisonMetrics:['transitionTime','movementQuality','runOrErgStability','sessionRpe'],
    requiredCapture:['sequenceCompleted','transitionTimeWhenMeasured','qualityDeviation','sessionRpe']
  }),
  COMPROMISED_RUNNING_REPEATABILITY: family('COMPROMISED_RUNNING_REPEATABILITY',{
    lane:'ADAPT',optionKeys:['compromised-repeatability'],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'BENCHMARK_EXACT',
    capabilityQuestion:'Can target running quality be reproduced after a controlled, repeatable pre-fatigue exposure?',
    benchmarkInvariants:['warmupStandard','preFatigueModality','preFatigueDose','preFatigueControlTarget','transitionRule','runDistance','recoveryRule','roundCount','environmentAssumption'],
    comparisonMetrics:['runSplit','runSplitDegradation','heartRateCost','heartRateRecovery','cadenceWhenReliable','gctWhenReliable','preFatigueOutput','transitionTime','sessionRpe','limitingSystem','executionFidelity'],
    requiredCapture:['roundRunSplit','heartRate','preFatigueOutput','transitionTimeWhenAvailable','sessionRpe','limitingSystem','executionDeviation']
  }),
  MATCHED_RUN_AET: family('MATCHED_RUN_AET',{
    lane:'ADAPT',optionKeys:['matched-run-aet'],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'BENCHMARK_EXACT',
    capabilityQuestion:'Has controlled running efficiency changed under the same matched AET protocol?',
    benchmarkInvariants:['existingMatchedRunAetProtocol','warmupStandard','workRecoveryStructure','routeOrTreadmillAssumption'],
    comparisonMetrics:['lapPace','heartRateByLap','cadence','gctWhenReliable','recoveryResponse','sessionRpe'],
    requiredCapture:['lapSplits','lapHeartRate','cadenceWhenAvailable','gctWhenAvailable','sessionRpe','executionDeviation']
  }),
  WALL_BALL_TOLERANCE: family('WALL_BALL_TOLERANCE',{
    lane:'ADAPT',optionKeys:['wall-ball-tolerance'],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'BENCHMARK_EXACT',
    capabilityQuestion:'Can repeatable wall-ball output be produced at an acceptable systemic and local recovery cost?',
    benchmarkInvariants:['existingWallBallAetProtocol','ballLoad','targetHeight','workRecoveryStructure','movementStandard'],
    comparisonMetrics:['completionQuality','repRateOrSplit','heartRateCost','sessionRpe','nextDayLocalResponse','fortyEightHourLocalResponse'],
    requiredCapture:['completionQuality','heartRate','sessionRpe','localSymptomsNextDay','localSymptoms48h']
  }),
  ERG_EFFICIENCY: family('ERG_EFFICIENCY',{
    lane:'ADAPT',optionKeys:['erg-efficiency'],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'BENCHMARK_EXACT',
    capabilityQuestion:'Can repeatable erg output be sustained at a controlled internal cost without excessive downstream fatigue?',
    benchmarkInvariants:['ergType','workUnit','machineSettingWhenMaterial','recoveryRule','outputControlTarget'],
    comparisonMetrics:['splitOrPower','heartRateCost','heartRateRecovery','strokeOrCadenceWhenAvailable','sessionRpe'],
    requiredCapture:['ergType','repSplitOrPower','heartRate','recoveryHeartRateWhenAvailable','sessionRpe']
  }),
  STATION_WORK_RATE: family('STATION_WORK_RATE',{
    lane:'ADAPT',optionKeys:['station-work-rate'],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'FAMILY_COMPARABLE',
    capabilityQuestion:'Can race-relevant station output be reproduced at a known downstream cost?',
    benchmarkInvariants:['stationIdentity','qualifiedLoad','movementStandard','workUnit','recoveryRule'],
    comparisonMetrics:['stationSplit','qualityDegradation','heartRateCost','downstreamRunningCostWhenApplicable','sessionRpe'],
    requiredCapture:['stationIdentity','load','workUnit','split','movementQuality','heartRate','sessionRpe'],
    notes:['Do not invent unsupported race loads.']
  }),
  STRENGTH_ENDURANCE_REPEATABILITY: family('STRENGTH_ENDURANCE_REPEATABILITY',{
    lane:'ADAPT',optionKeys:[],prescriptionLevel:'PROTOCOL',defaultComparisonClass:'FAMILY_COMPARABLE',
    capabilityQuestion:'Can repeated strength-endurance output be maintained with limited quality degradation?',
    benchmarkInvariants:['exerciseIdentity','load','repTarget','setCount','restRule','movementStandard'],
    comparisonMetrics:['repCompletion','setTimeWhenRelevant','qualityDegradation','rirOrRpe','heartRateCost'],
    requiredCapture:['exercise','load','reps','sets','rest','qualityDeviation','rirOrRpe']
  })
});

export function protocolFamilyForOptionKey(optionKey){
  return Object.values(SESSION_PROTOCOL_FAMILIES).find(item=>item.optionKeys.includes(optionKey))||null;
}

export function laneRequiresProtocolFamily(lane){
  return lane==='ADAPT'||lane==='MAINTAIN';
}

export function protocolCoverageSummary(){
  const families=Object.values(SESSION_PROTOCOL_FAMILIES);
  return {
    measurementPriorityByLane:MEASUREMENT_PRIORITY_BY_LANE,
    familyCount:families.length,
    maintainFamilies:families.filter(item=>item.lane==='MAINTAIN').map(item=>item.protocolFamilyId),
    adaptFamilies:families.filter(item=>item.lane==='ADAPT').map(item=>item.protocolFamilyId)
  };
}
