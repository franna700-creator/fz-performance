import fs from 'node:fs';

const path='src/adaptive-choice.js';
let js=fs.readFileSync(path,'utf8');

const patches=[
  [
    'landingDismissed:false};',
    'landingDismissed:false,authDialogMode:null};'
  ],
  [
    'function showAuth(mode){const overlay=ensureOverlay();',
    'function showAuth(mode){FZ_CHOICE.authDialogMode=mode;const overlay=ensureOverlay();'
  ],
  [
    "function hideOverlay(){const overlay=ensureOverlay();overlay.hidden=true;overlay.innerHTML='';document.body.classList.remove('fz-modal-open');}",
    "function hideOverlay(){FZ_CHOICE.authDialogMode=null;const overlay=ensureOverlay();overlay.hidden=true;overlay.innerHTML='';document.body.classList.remove('fz-modal-open');}"
  ],
  [
    "function reconcileLanding(){\n  if(FZ_CHOICE.auth.available!==true||athleteMode()||FZ_CHOICE.landingDismissed){hideOverlay();return;}",
    "function reconcileLanding(){\n  if(FZ_CHOICE.authDialogMode)return;\n  if(FZ_CHOICE.auth.available!==true||athleteMode()||FZ_CHOICE.landingDismissed){hideOverlay();return;}"
  ],
  [
    "if(event.target.closest('[data-auth-close]')){hideOverlay();return;}",
    "if(event.target.closest('[data-auth-close]')){hideOverlay();scheduleRender();return;}"
  ]
];

for(const [before,after] of patches){
  if(js.includes(after))continue;
  if(!js.includes(before))throw new Error(`Athlete Access stability patch anchor missing: ${before.slice(0,80)}`);
  js=js.replace(before,after);
}

fs.writeFileSync(path,js);
console.log('PASS Athlete Access dialog stability hotfix applied idempotently');
