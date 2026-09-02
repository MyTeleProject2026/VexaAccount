(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_PREMIUM_THEME_V1__)return;
window.__VEXA_ACCOUNT_PREMIUM_THEME_V1__=true;
const id='vexa-account-premium-theme-v1';
if(document.getElementById(id))return;
const s=document.createElement('style');s.id=id;s.textContent=`
:root{
 --vx-cyan:#19d9e6!important;--vx-violet:#7c5cff!important;
 --vx-bg:#050811!important;--vx-surface:rgba(255,255,255,.075)!important;
 --vx-border:rgba(255,255,255,.13)!important;--vx-text:#eef2ff!important;
 --vx-muted:#9ca8c2!important;
}
html{background:#050811!important;scroll-behavior:smooth!important}
body{background:radial-gradient(900px 600px at 5% -10%,rgba(124,92,255,.20),transparent 60%),radial-gradient(800px 560px at 100% 100%,rgba(25,217,230,.13),transparent 60%),#050811!important;color:#eef2ff!important}
.vx-ac,.vx-main,.vx-content{background:transparent!important;color:#eef2ff!important}
.vx-side{background:linear-gradient(180deg,rgba(10,15,28,.84),rgba(7,11,21,.70))!important;border-color:rgba(255,255,255,.10)!important;backdrop-filter:blur(26px) saturate(140%)!important;-webkit-backdrop-filter:blur(26px) saturate(140%)!important}
.vx-top{background:rgba(8,13,24,.76)!important;border-color:rgba(255,255,255,.10)!important;backdrop-filter:blur(26px) saturate(140%)!important;-webkit-backdrop-filter:blur(26px) saturate(140%)!important}
.vx-card,.vx-action,.vx-icon,.vx-btn,.vx-search,.vx-modal,.vx-mobile{background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.025))!important;border-color:rgba(255,255,255,.13)!important;color:#eef2ff!important;box-shadow:0 24px 70px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.05)!important;backdrop-filter:blur(26px) saturate(140%)!important;-webkit-backdrop-filter:blur(26px) saturate(140%)!important}
.vx-hero{background:linear-gradient(135deg,#17113b,#24306e 56%,#075e69)!important;box-shadow:0 18px 50px rgba(0,0,0,.28)!important}
.vx-title,.vx-card-title,.vx-action-title,.vx-info-value,.vx-row b,.vx-brand b,.vx-mini b{color:#f5f7ff!important}
.vx-head p,.vx-desc,.vx-action-text,.vx-info-label,.vx-row small,.vx-mini small,.muted{color:#9ca8c2!important}
.vx-nav button{color:#aeb8d0!important;border:1px solid transparent!important;transition:transform .20s cubic-bezier(.2,.8,.2,1),background .20s,border-color .20s,color .20s,box-shadow .20s!important}
.vx-nav button:hover{transform:translateX(3px)!important;background:rgba(255,255,255,.045)!important;border-color:rgba(255,255,255,.07)!important;color:#fff!important}
.vx-nav button.active{background:linear-gradient(100deg,rgba(124,92,255,.20),rgba(25,217,230,.08))!important;border-color:rgba(25,217,230,.12)!important;color:#fff!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 28px rgba(0,0,0,.14)!important}
.vx-action{transition:transform .20s cubic-bezier(.2,.8,.2,1),background .20s,border-color .20s,box-shadow .20s!important;cursor:pointer}
.vx-action:hover{transform:translateY(-2px)!important;background:rgba(255,255,255,.075)!important;border-color:rgba(25,217,230,.20)!important}
.vx-btn,.vx-icon{transition:transform .20s cubic-bezier(.2,.8,.2,1),filter .20s,box-shadow .20s,background .20s!important;cursor:pointer}
.vx-btn:not(:disabled):hover,.vx-icon:not(:disabled):hover{transform:translateY(-2px)!important;filter:brightness(1.08)!important;box-shadow:0 14px 34px rgba(0,0,0,.30),0 0 0 1px rgba(25,217,230,.08)!important}
.vx-btn:not(:disabled):active,.vx-icon:not(:disabled):active{transform:translateY(1px) scale(.975)!important;filter:brightness(.98)!important}
.vx-btn.primary{background:linear-gradient(135deg,#7c5cff,#19bfcf)!important;border-color:rgba(255,255,255,.18)!important;color:#fff!important;box-shadow:0 10px 30px rgba(124,92,255,.22)!important}
.vx-btn.danger{color:#fecaca!important;border-color:rgba(248,113,113,.28)!important}
.vx-input,.vx-select,.vx-textarea{background:rgba(0,0,0,.22)!important;border-color:rgba(255,255,255,.13)!important;color:#fff!important}
.vx-input::placeholder,.vx-textarea::placeholder{color:#71809e!important}
.vx-input:focus,.vx-select:focus,.vx-textarea:focus{border-color:rgba(25,217,230,.55)!important;box-shadow:0 0 0 3px rgba(25,217,230,.10)!important}
.vx-modal-bg{background:rgba(2,5,12,.68)!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important}
.vx-toast-stack{filter:drop-shadow(0 18px 45px rgba(0,0,0,.30))}
.vx-toast{background:rgba(12,18,32,.90)!important;border:1px solid rgba(255,255,255,.12)!important;color:#fff!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important}
.vx-toast.success{background:rgba(8,72,48,.92)!important}
.vx-toast.error{background:rgba(95,25,35,.92)!important}
.vx-toast.warning{background:rgba(92,55,10,.92)!important}
.vx-stat-icon,.vx-avatar,.vx-action-icon{background:rgba(255,255,255,.075)!important;border:1px solid rgba(255,255,255,.10)!important}
.vx-info,.vx-row,.vx-table th,.vx-table td{border-color:rgba(255,255,255,.08)!important}
.vx-table th{background:rgba(255,255,255,.045)!important;color:#9ca8c2!important}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}.vx-btn,.vx-icon,.vx-action,.vx-nav button{transition:none!important}}
`;
document.head.appendChild(s);
})();
