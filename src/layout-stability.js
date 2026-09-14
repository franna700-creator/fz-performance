/* FZ viewport stability guard.
 * Canonical background rereads may rebuild the active page, but they must not
 * impersonate deliberate navigation by forcing the athlete back to the top.
 */
const nativeScrollTo=window.scrollTo.bind(window);
let navigationIntentUntil=0;

function isNavigationControl(target){return Boolean(target?.closest?.('[data-page],[data-open-page]'));}
function authorizeNavigation(){navigationIntentUntil=performance.now()+750;}
function requestedTop(args){
  if(!args.length)return null;
  const first=args[0];
  if(typeof first==='object'&&first!==null)return Number(first.top);
  return Number(args[1]);
}
function requestedBehavior(args){const first=args[0];return typeof first==='object'&&first!==null?String(first.behavior||''):'';}

// Capture before app-clean handles the same click and invokes showPage().
document.addEventListener('click',event=>{if(isNavigationControl(event.target))authorizeNavigation();},true);

window.scrollTo=function fzStableScrollTo(...args){
  const top=requestedTop(args),behavior=requestedBehavior(args);
  const activePage=document.querySelector('.page.active');
  const deliberateNavigation=performance.now()<=navigationIntentUntil;
  const canonicalSamePageReset=Boolean(activePage&&top===0&&behavior==='instant'&&!deliberateNavigation);
  if(canonicalSamePageReset)return;
  return nativeScrollTo(...args);
};

window.FZ_LAYOUT_STABILITY={
  version:'1.0.0',
  authorizeNavigation,
  get navigationIntentActive(){return performance.now()<=navigationIntentUntil;}
};
