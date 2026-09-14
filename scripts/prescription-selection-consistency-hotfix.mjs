import fs from 'node:fs';

function apply(path, patches, label){
  let text=fs.readFileSync(path,'utf8');
  for(const [before,after] of patches){
    if(text.includes(after))continue;
    if(!text.includes(before))throw new Error(`${label} patch anchor missing: ${before.slice(0,100)}`);
    text=text.replace(before,after);
  }
  fs.writeFileSync(path,text);
}

apply('lib/intelligence-current.js',[
  [
    "import { SESSION_OPTION_COMPOSER_VERSION } from './session-option-composer.js';",
    "import { SESSION_OPTION_COMPOSER_VERSION } from './session-option-composer.js';\nimport { SESSION_PRESCRIPTION_COMPOSER_VERSION } from './session-prescription-resolver.js';"
  ],
  [
    "    active.status === (shadow.status === 'READY' ? 'READY' : 'WITHHELD') &&\n    active.sessionOptionComposerVersion === SESSION_OPTION_COMPOSER_VERSION\n  );",
    "    active.status === (shadow.status === 'READY' ? 'READY' : 'WITHHELD') &&\n    active.sessionOptionComposerVersion === SESSION_OPTION_COMPOSER_VERSION &&\n    active.sessionPrescriptionComposerVersion === SESSION_PRESCRIPTION_COMPOSER_VERSION &&\n    Object.values(active.lanes || {}).every(options => (options || []).every(option =>\n      option?.prescription?.composerVersion === SESSION_PRESCRIPTION_COMPOSER_VERSION &&\n      Boolean(option?.prescription?.prescriptionFingerprint)\n    ))\n  );"
  ],
  [
    "    sessionOptionComposerVersion: SESSION_OPTION_COMPOSER_VERSION,\n    currentRecoveryFreshnessPolicy: CURRENT_RECOVERY_FRESHNESS_POLICY",
    "    sessionOptionComposerVersion: SESSION_OPTION_COMPOSER_VERSION,\n    sessionPrescriptionComposerVersion: SESSION_PRESCRIPTION_COMPOSER_VERSION,\n    currentRecoveryFreshnessPolicy: CURRENT_RECOVERY_FRESHNESS_POLICY"
  ],
  [
    "      activeMatchesShadow: !pendingActive,\n      sessionOptionComposerCurrent: !pendingActive",
    "      activeMatchesShadow: !pendingActive,\n      sessionOptionComposerCurrent: !pendingActive,\n      sessionPrescriptionComposerCurrent: !pendingActive"
  ]
],'intelligence-current');

apply('src/adaptive-choice.js',[
  [
    "function selectionControl(option,lane){\n  if(option.prescription?.selectionReady===false)return `<div class=\"fz-option-choice fz-choice-disabled\"><span>${esc(option.prescription.releaseReason||'This protocol is not released for selection.')}</span><button type=\"button\" disabled>Not released</button></div>`;",
    "function selectionReady(option,lane){\n  const p=option?.prescription;\n  if(!p||p.selectionReady!==true||!p.prescriptionFingerprint)return false;\n  if(['MAINTAIN','ADAPT'].includes(lane)&&!p.protocolFamilyId)return false;\n  return true;\n}\nfunction choiceErrorMessage(error){\n  const raw=String(error?.message||error||'Selection failed');\n  if(raw.includes('choice_prescription_required')||raw.includes('choice_prescription_not_ready'))return 'This session is still being reconciled to its current execution prescription. Refresh FZ and try again.';\n  return raw;\n}\nfunction selectionControl(option,lane){\n  if(!selectionReady(option,lane))return `<div class=\"fz-option-choice fz-choice-disabled\"><span>${esc(option.prescription?.releaseReason||'FZ is reconciling this option to the current prescription version. Refresh FZ and try again.')}</span><button type=\"button\" disabled>Not ready</button></div>`;"
  ],
  [
    "async function selectOption(lane,optionId,button){\n  const rec=active();if(!athleteMode()||!rec?.recommendationVersion)return;\n  button.disabled=true;const previous=button.textContent;button.textContent='Saving…';",
    "async function selectOption(lane,optionId,button){\n  const rec=active();if(!athleteMode()||!rec?.recommendationVersion)return;\n  const option=Array.isArray(rec?.lanes?.[lane])?rec.lanes[lane].find(item=>item.optionId===optionId):null;\n  if(!selectionReady(option,lane)){button.disabled=true;button.textContent='Not ready';return;}\n  button.disabled=true;const previous=button.textContent;button.textContent='Saving…';"
  ],
  [
    "  }catch(error){button.disabled=false;button.textContent=previous;window.alert?.(String(error?.message||error));}",
    "  }catch(error){button.disabled=false;button.textContent=previous;window.alert?.(choiceErrorMessage(error));}"
  ]
],'adaptive-choice');

console.log('PASS prescription selection consistency hotfix applied idempotently');
