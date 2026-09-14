import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/adaptive-choice.js','utf8');
assert.match(js,/authDialogMode:null/,'dialog state must be explicit');
assert.match(js,/function showAuth\(mode\)\{FZ_CHOICE\.authDialogMode=mode;/,'opening auth must mark the dialog active before rendering it');
assert.match(js,/function hideOverlay\(\)\{FZ_CHOICE\.authDialogMode=null;/,'closing an overlay must clear active dialog state');
assert.match(js,/function reconcileLanding\(\)\{\s*if\(FZ_CHOICE\.authDialogMode\)return;/,'landing reconciliation must not overwrite an active auth form');
assert.match(js,/\[data-auth-close\]'\)\)\{hideOverlay\(\);scheduleRender\(\);return;\}/,'closing auth must deliberately reconcile back to the landing/viewer state');
console.log('PASS Athlete Access dialog state is stable across adaptive rerenders');
