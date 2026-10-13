(function(){
"use strict";
var D=document, root=D.documentElement, body=D.body;
var KEY="bookreader:"+(root.getAttribute("data-book-key")||location.pathname.split("/").pop()||"book");  /* data-book-key: 한 주소에서 여러 책을 여는 앱(syepubreader)이 책별 저장키를 지정 */
/* 텍스트를 HTML 로 끼울 때 반드시 경유 — 장 제목 등 책 내용은 신뢰 불가(목차에 <img onerror> 같은 제목을 심은 EPUB 의 스크립트 실행 차단) */
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function el(tag,cls,html){var e=D.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function applyTheme(t){if(t)root.setAttribute("data-theme",t);}
function applyFont(px){if(px)root.style.setProperty("--fs",px+"px");}
var pageEl=D.querySelector(".page");
function spGap(){if(!pageEl)return 0;var g=parseFloat(getComputedStyle(pageEl).columnGap);return isNaN(g)?0:g;}  /* 실제 적용된 칼럼 gap(모드 무관) */
/* 한 쪽(spread=2단·paged=1단) 넘김 간격 = 실제 렌더 폭(소수 px) + gap. clientWidth(정수 반올림)로 계산하면 dvw 폭의 소수점 오차가 idx*오차로 누적돼 뒤쪽 장에서 글자가 잘림 → 모든 페이저 계산의 단일 창구. */
function pagePitch(){if(!pageEl)return 0;return pageEl.getBoundingClientRect().width+spGap();}

/* progress bar */
var prog=el("div","progress");body.appendChild(prog);

/* 화면 고정 상하 거터(letterbox) — 「상하 여백」 설정이 높이(--gut-top/bottom)를 제어. 0이면 안 보임. */
body.appendChild(el("div","rz-top"));body.appendChild(el("div","rz-bottom"));

/* 페이지 번호 표시(전체페이지 보기에서만) */
var pageInd=el("div","page-ind");body.appendChild(pageInd);

/* copied flash */
var flash=el("div","copied","복사됨");body.appendChild(flash);
function toastCopied(){flash.classList.add("show");setTimeout(function(){flash.classList.remove("show");},900);}

/* lightbox */
var lb=el("div","lightbox");var lbImg=el("img"),lbCap=el("div","lb-cap"),lbX=el("button","lb-close","×");
lb.appendChild(lbX);lb.appendChild(lbImg);lb.appendChild(lbCap);body.appendChild(lb);
function closeLb(){lb.classList.remove("show");}
lb.addEventListener("click",closeLb);lbX.addEventListener("click",closeLb);
lbImg.addEventListener("click",function(e){e.stopPropagation();});
D.addEventListener("keydown",function(e){if(e.key==="Escape")closeLb();});
[].forEach.call(D.querySelectorAll(".figimg img"),function(img){
  img.addEventListener("click",function(){
    lbImg.src=img.src;
    var fc=img.closest(".figimg");var cap=fc&&fc.querySelector(".cap");
    lbCap.textContent=cap?cap.textContent:"";lb.classList.add("show");
  });
});

/* copy buttons */
function addCopy(container,textEl){
  var b=el("button","copy-btn","복사");
  b.addEventListener("click",function(ev){ev.stopPropagation();
    var t=(textEl||container).innerText;
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(toastCopied,function(){});}
    else{var ta=el("textarea");ta.value=t;body.appendChild(ta);ta.select();try{D.execCommand("copy");toastCopied();}catch(e){}body.removeChild(ta);}
  });
  container.appendChild(b);
}
[].forEach.call(D.querySelectorAll(".listing"),function(l){var pre=l.querySelector("pre");if(pre)addCopy(l,pre);});
[].forEach.call(D.querySelectorAll("pre.code"),function(p){if(!p.closest(".listing")){p.style.position="relative";addCopy(p,p);}});
[].forEach.call(D.querySelectorAll("pre.spec"),function(p){p.style.position="relative";addCopy(p,p);});

/* collapsible long pre */
[].forEach.call(D.querySelectorAll("pre.spec,pre.code"),function(p){
  if(p.scrollHeight>520){
    p.classList.add("collapsible");
    var wrap=el("div","pre-wrap");p.parentNode.insertBefore(wrap,p);wrap.appendChild(p);
    var fade=el("div","pre-fade");var exp=el("button","expand-btn","↓ 펼치기");
    fade.appendChild(exp);wrap.appendChild(fade);
    exp.addEventListener("click",function(){p.classList.add("open");fade.remove();});
  }
});

/* heading deep-links */
[].forEach.call(D.querySelectorAll(".sec-head[id],.sub[id]"),function(h){
  var a=el("a","anchor-link","#");a.href="#"+h.id;a.title="이 절 링크 복사";
  a.addEventListener("click",function(ev){ev.preventDefault();pushNav();
    var url=location.href.split("#")[0]+"#"+h.id;history.replaceState(null,"",url);
    if(navigator.clipboard)navigator.clipboard.writeText(url).then(toastCopied,function(){});
    scrollToEl(h);  /* 가로 페이저에선 칼럼 경계 정렬 이동(세로 scrollIntoView 는 페이저를 깨뜨림) */
  });
  h.insertBefore(a,h.firstChild);
});

/* reading time per article */
function readMin(txt){return Math.max(1,Math.round((txt||"").replace(/\s+/g,"").length/650));}
var arts=[].slice.call(D.querySelectorAll("article.doc"));
arts.forEach(function(a){
  var cover=a.querySelector(".chapter-cover");
  if(cover){var m=readMin(a.innerText);var ko=((root.getAttribute("lang")||"ko").slice(0,2)==="ko");cover.appendChild(el("div","ch-readtime",ko?"🕒 약 "+m+"분 분량":"🕒 ~"+m+" min read"));}
});

/* drawer TOC */
var overlay=el("div","drawer-overlay");
var drawer=el("div","drawer");
var _KO=((document.documentElement.getAttribute("lang")||"ko").slice(0,2)==="ko");  /* chrome 언어: 영어책이면 UI 라벨도 영어 */
function L(ko,en){return _KO?ko:en;}  /* 라벨 언어 분기(ko=한국어책/번역본, en=영어 원서 passthrough) */
var dhead=el("div","drawer-head");dhead.appendChild(el("h2",null,_KO?"목차":"Contents"));
var filter=el("input","toc-filter");filter.type="search";filter.placeholder=_KO?"제목 검색…":"Search title…";filter.setAttribute("aria-label",_KO?"목차 검색":"Search contents");
dhead.appendChild(filter);
var dbody=el("div","drawer-body");
drawer.appendChild(dhead);drawer.appendChild(dbody);
body.appendChild(overlay);body.appendChild(drawer);

var tocLinks=[];
arts.forEach(function(a){
  if(!a.id){a.id="doc-"+Math.round(a.getBoundingClientRect().top);}
  var cover=a.querySelector(".chapter-cover");
  var title=cover?((cover.querySelector(".ch-title")||{}).textContent||"").trim():a.id;
  var num=cover?((cover.querySelector(".ch-num")||{}).textContent||"").trim():"";
  var grp=el("div","toc-chap");
  var ta=el("a","tc-title");ta.href="#"+a.id;ta.dataset.target=a.id;
  ta.innerHTML=(num?'<span class="tc-rt">'+esc(num)+'</span> ':'')+esc(title||a.id)+' <span class="tc-rt">· '+readMin(a.innerText)+(_KO?'분':' min')+'</span>';
  grp.appendChild(ta);tocLinks.push(ta);
  [].forEach.call(a.querySelectorAll(".sec-head[id],.sub[id]"),function(h){
    var isSub=h.classList.contains("sub");
    var link=el("a","toc-sec"+(isSub?" lv-sub":""));link.href="#"+h.id;link.dataset.target=h.id;
    link.textContent=h.textContent.replace(/^#/,"").trim();
    grp.appendChild(link);tocLinks.push(link);
  });
  dbody.appendChild(grp);
});
function closeDrawer(){drawer.classList.remove("show");overlay.classList.remove("show");}
function openDrawer(){drawer.classList.add("show");overlay.classList.add("show");filter.focus();}
overlay.addEventListener("click",closeDrawer);
dbody.addEventListener("click",function(e){
  var a=e.target.closest("a");if(!a)return;
  /* 기본 해시 점프는 가로 페이저의 scrollLeft 를 칼럼 경계 무시하고 설정 → 반쪽 페이지 깨짐. 직접 정렬 이동으로 대체. */
  e.preventDefault();
  var id=decodeURIComponent((a.hash||"").slice(1));
  var t=id?D.getElementById(id):null;
  pushNav();closeDrawer();
  if(id)history.replaceState(null,"",location.href.split("#")[0]+"#"+id);
  scrollToEl(t);
});
filter.addEventListener("input",function(){
  var q=filter.value.trim().toLowerCase();
  [].forEach.call(dbody.querySelectorAll("a"),function(a){
    a.classList.toggle("toc-hidden",!(!q||a.textContent.toLowerCase().indexOf(q)>=0));
  });
});

/* landmark stepping + visit-history back-stack */
var landmarks=[].slice.call(D.querySelectorAll(".chapter-cover,.sec-head"));
function lmTop(e){return e.getBoundingClientRect().top+window.scrollY;}
function curLmIndex(){var y=window.scrollY+120,idx=0;for(var i=0;i<landmarks.length;i++){if(lmTop(landmarks[i])<=y)idx=i;else break;}return idx;}
function goLm(delta){
  if(isPager()&&pageEl){
    /* 가로 페이저: 랜드마크를 칼럼 인덱스로 환산해 현재 칼럼과 다른 다음/이전 것으로 정렬 이동. 없으면 한 페이지 넘김. */
    var N=root.classList.contains("spread")?2:1;
    var colPitch=pagePitch()/N;if(colPitch<=0)return;
    var pl=pageEl.getBoundingClientRect().left,sl=pageEl.scrollLeft,cur=Math.round(sl/colPitch),cand=null;
    for(var i=0;i<landmarks.length;i++){
      var c=Math.round((landmarks[i].getBoundingClientRect().left-pl+sl)/colPitch);
      if(delta>0){if(c>cur){cand=landmarks[i];break;}}
      else if(c<cur)cand=landmarks[i];else break;
    }
    if(cand)scrollToEl(cand);else goPage(delta>0?1:-1);
    return;
  }
  var i=Math.max(0,Math.min(landmarks.length-1,curLmIndex()+delta));window.scrollTo({top:lmTop(landmarks[i])-14,behavior:"smooth"});}
/* ‹ ›/방향키 이동 단위. scroll=화면 절반(기본) / page=한 화면(SumatraPDF식·0.9 겹침). 휠 연속 스크롤은 별개로 항상 동작. */
var pageFactor=(ls(KEY+":step")==="scroll")?0.5:0.85;  /* 기본=페이지(한 화면·약 15% 겹침 peek) */
var peekEl=el("div","peek-flash");body.appendChild(peekEl);var peekT=null;
function peekFlash(){var h=Math.max(60,Math.round(window.innerHeight*0.15));peekEl.style.height=h+"px";peekEl.classList.add("show");clearTimeout(peekT);peekT=setTimeout(function(){peekEl.classList.remove("show");},700);}
/* 넘김: 책(spread)=가로 1펼침, 전체페이지(paged)=세로 1화면(peek 없음), 연속=pageFactor(0.85·peek). */
/* 가로 페이저 이동 — 현재 위치의 가장 가까운 칼럼을 기준으로 '절대 목표'를 계산해 scrollTo.
   상대 scrollBy 가 빠른 연타/스무스 중첩/리플로우에서 누적 실패해 경계를 벗어나던 버그 해소(항상 칼럼 경계 정렬). cols=이동할 칼럼 수. */
function pagerGo(dir,cols,from){
  if(!pageEl)return false;
  var N=root.classList.contains("spread")?2:1;
  var colPitch=pagePitch()/N;if(colPitch<=0)return false;
  var max=Math.max(0,pageEl.scrollWidth-pageEl.clientWidth);
  /* 빠른 연타: 넘김 진행 중이면 '현재 위치'가 아니라 '진행 중인 목표'에 누적 — 연타 수만큼 정확히, 항상 쪽 경계에 정렬 */
  var base=(pagerTarget!==null)?pagerTarget:pageEl.scrollLeft;
  var t=Math.max(0,Math.min((Math.round(base/colPitch)+dir*cols)*colPitch,max));
  if(Math.abs(t-base)<1)return false;  /* 첫/끝 쪽 */
  pagerTarget=t;turnTo(t,dir,from);return true;}
var pagerTarget=null;
/* 쪽 넘김 = 방향 있는 페이드 — 지금 쪽이 진행 방향으로 살짝 밀리며 사라지고(110ms) → 즉시 목표 쪽으로 이동 → 반대편에서 살짝 밀려 들어오며 나타남(170ms).
   다음 쪽(오→왼)·이전 쪽(왼→오). 두 쪽이 한 화면에 동시에 걸리는 순간이 없어 '다음 쪽이 붙어 보이는' 다단 간격 착시가 원천적으로 없다.
   (구: 글 띠를 1:1 로 끌고 경계에 회색 띠를 덧그림 → 본문을 가려 제거.) 동작 줄이기 설정이면 애니메이션 없이 즉시. */
var REDUCE_MOTION=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
var turnAnim=null,turnPhase=0;  /* 0=정지 1=사라지는 중 2=나타나는 중 */
function jumpTo(left){var pb=pageEl.style.scrollBehavior;pageEl.style.scrollBehavior="auto";pageEl.scrollLeft=left;pageEl.style.scrollBehavior=pb;updatePageInd();}
function turnTo(target,dir,from){
  if(REDUCE_MOTION||!pageEl.animate){jumpTo(target);pagerTarget=null;return;}
  if(turnPhase===1)return;  /* 사라지는 중엔 목표(pagerTarget)만 갱신 — 나타날 때 최신 목표로 간다 */
  var d=Math.round(Math.min(56,pageEl.clientWidth*0.05))*(dir>0?1:-1),f=from||{x:0,o:1};
  if(turnAnim)turnAnim.cancel();
  turnPhase=1;
  var out=turnAnim=pageEl.animate([{transform:"translateX("+f.x+"px)",opacity:f.o},{transform:"translateX("+(-d)+"px)",opacity:0}],{duration:110,easing:"ease-in",fill:"forwards"});
  out.onfinish=function(){
    if(turnAnim!==out)return;
    jumpTo(pagerTarget);turnPhase=2;
    var inn=turnAnim=pageEl.animate([{transform:"translateX("+d+"px)",opacity:0},{transform:"translateX(0)",opacity:1}],{duration:170,easing:"ease-out"});
    out.cancel();  /* 나타남 애니를 먼저 건 뒤 해제 — 사이에 원위치가 한 프레임 보이는 깜빡임 방지 */
    inn.onfinish=function(){if(turnAnim===inn){turnAnim=null;turnPhase=0;pagerTarget=null;}};
  };
}
/* 모드 불문 "요소로 이동" 단일 창구 — 가로 페이저에선 요소가 속한 칼럼 경계로 정렬 스크롤(반쪽 페이지 금지), 연속 모드는 기존 scrollIntoView. */
function scrollToEl(el){
  if(!el)return;
  if(isPager()&&pageEl){
    var N=root.classList.contains("spread")?2:1;
    var colPitch=pagePitch()/N;if(colPitch<=0)return;
    var x=el.getBoundingClientRect().left-pageEl.getBoundingClientRect().left+pageEl.scrollLeft;
    var idx=Math.round(x/colPitch),max=Math.max(0,pageEl.scrollWidth-pageEl.clientWidth);
    /* 즉시 점프(스무스X) — 먼 절은 수십만 px(수백 쪽) 떨어져 스무스는 느리고 중도 실패. .page 에 CSS scroll-behavior:smooth 가 걸려 scrollTo({behavior:"auto"})조차 애니메이션되므로, realignPager 와 동일하게 scroll-behavior 를 일시 해제 후 scrollLeft 직접 대입. */
    var prev=pageEl.style.scrollBehavior;pageEl.style.scrollBehavior="auto";
    pageEl.scrollLeft=Math.max(0,Math.min(idx*colPitch,max));
    pageEl.style.scrollBehavior=prev;
  }else{el.scrollIntoView();}
}
function goPage(dir){
  if(isPager()&&pageEl){pagerGo(dir,root.classList.contains("spread")?2:1);return;}
  var step=Math.max(80,Math.round(window.innerHeight*pageFactor));
  window.scrollTo({top:window.scrollY+dir*step,behavior:"smooth"});peekFlash();}
/* 한 칼럼씩 슬라이드(↑↓ 전용). 책(2쪽)=오른쪽 쪽이 왼쪽으로 오고 새 쪽이 오른쪽에(연속성 보존) · 페이지(1쪽)=1쪽 이동. */
function goCol(dir){if(isPager()&&pageEl)pagerGo(dir,1);}
/* 보기 방식 전환: flow(연속 세로)·paged(1칼럼 가로)·spread(2칼럼 가로). paged·spread 는 같은 멀티컬럼 가로 페이저. */
function isPager(){return root.classList.contains("paged")||root.classList.contains("spread");}
function setView(v){
  root.classList.remove("paged","spread");
  if(v==="paged")root.classList.add("paged");
  else if(v==="spread")root.classList.add("spread");
  if(pageEl){
    pageEl.scrollLeft=0;
    /* 모드 전환 시 멀티컬럼 강제 재레이아웃/재페인트 — Chromium 이 칼럼 속성 라이브 변경 시 남기는 잔상·겹침 제거. */
    var d=pageEl.style.display;pageEl.style.display="none";void pageEl.offsetHeight;pageEl.style.display=d;
  }
  updatePageInd();updateControlVis();}
function updatePageInd(){
  if(isPager()&&pageEl){
    var pitch=pagePitch();if(pitch<=0){pageInd.classList.remove("show");return;}
    var total=Math.max(1,Math.round(pageEl.scrollWidth/pitch)),cur=Math.min(total,Math.round(pageEl.scrollLeft/pitch)+1);
    pageInd.textContent=cur+" / "+total+(_KO?(root.classList.contains("spread")?" 펼침":" 쪽"):"")  /* 영어책은 숫자만(한국어 라벨은 크롬 번역이 다시 번역) */;pageInd.classList.add("show");return;}
  pageInd.classList.remove("show");}
/* 폭(양옆폭/가운데폭/--wide)/리사이즈로 .page 폭이 바뀌면 pitch 가 바뀜 → 현재 scrollLeft 를 가장 가까운 페이지 경계로 재정렬(경계 어긋남 방지). */
function realignPager(){if(!isPager()||!pageEl)return;var pitch=pagePitch();if(pitch<=0)return;var idx=Math.round(pageEl.scrollLeft/pitch);var prev=pageEl.style.scrollBehavior;pageEl.style.scrollBehavior="auto";pageEl.scrollLeft=idx*pitch;pageEl.style.scrollBehavior=prev;updatePageInd();}
var navStack=[],backBtnRef=null;
function updateBack(){if(backBtnRef){backBtnRef.style.opacity=navStack.length?"1":".4";backBtnRef.disabled=!navStack.length;}}
function pushNav(){navStack.push(window.scrollY);if(navStack.length>60)navStack.shift();updateBack();}
function goBack(){if(!navStack.length)return;window.scrollTo({top:navStack.pop(),behavior:"smooth"});updateBack();}
D.addEventListener("keydown",function(e){
  if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
  /* ↑↓ = 화면 스크롤(이동 단위 적용) · ←→ = 소절 이동 · PageUp/Down = 브라우저 기본 유지(가로채지 않음) */
  /* ↑↓·Space·PageUp/Dn·휠 = 시스템 기본(네이티브 스크롤) 그대로 둔다. ←→ = 페이지 넘김(peek) */
  if(e.key==="ArrowRight"){e.preventDefault();goPage(1);}
  else if(e.key==="ArrowLeft"){e.preventDefault();goPage(-1);}
  else if(isPager()&&e.key==="ArrowDown"){e.preventDefault();goCol(1);}   /* 한 칼럼 앞으로(오른쪽→왼쪽, 새 쪽 오른쪽) */
  else if(isPager()&&e.key==="ArrowUp"){e.preventDefault();goCol(-1);}    /* 한 칼럼 뒤로 */
  else if((root.classList.contains("paged")||root.classList.contains("spread"))&&(e.key===" "||e.key==="PageDown")){e.preventDefault();goPage(e.shiftKey?-1:1);}
  else if((root.classList.contains("paged")||root.classList.contains("spread"))&&e.key==="PageUp"){e.preventDefault();goPage(-1);}
});

/* controls panel — 보기 방식(최상위 스위치) 먼저 → 모드별 옵션만 노출(contextual/progressive disclosure) */
var controls=el("div","controls");controls.appendChild(el("h3",null,L("읽기 설정","Reading settings")));
var ctlRows=[];
function tagRow(row,modes){row.dataset.modes=modes?modes.join(","):"all";ctlRows.push(row);}
/* 기본 보기: PC(큰 화면+정밀 포인터)=책(spread) · 그 외(모바일/태블릿)=페이지(paged). 저장된 설정이 있으면 그걸 우선. */
function isPC(){try{return window.matchMedia("(min-width:1024px) and (pointer:fine)").matches;}catch(e){return (window.innerWidth||0)>=1024;}}
function defaultView(){return isPC()?"spread":"paged";}
function curView(){return ls(KEY+":view")||defaultView();}
function updateControlVis(){var v=curView();ctlRows.forEach(function(row){var m=row.dataset.modes;row.style.display=(m==="all"||m.split(",").indexOf(v)>=0)?"":"none";});}
function seg(label,opts,getCur,onPick,modes){
  var row=el("div","ctl-row");row.appendChild(el("span",null,label));
  var s=el("div","seg");
  opts.forEach(function(o){var b=el("button",null,o.label);b.dataset.val=o.val;
    b.addEventListener("click",function(){onPick(o.val);[].forEach.call(s.children,function(c){c.classList.toggle("on",c.dataset.val===String(o.val));});});
    s.appendChild(b);});
  row.appendChild(s);controls.appendChild(row);tagRow(row,modes);
  var cur=getCur();[].forEach.call(s.children,function(c){c.classList.toggle("on",c.dataset.val===String(cur));});
}
/* 슬라이더 행: 라벨 + 숫자 readout + range. */
function rangeRow(label,min,max,step,unit,get,onInput,modes){
  var row=el("div","ctl-row ctl-rrow");
  var head=el("div","ctl-rhead");head.appendChild(el("span",null,label));
  var val=el("span","ctl-rval");head.appendChild(val);
  var r=el("input","ctl-range");r.type="range";r.min=min;r.max=max;r.step=step;
  var cur=get();r.value=cur;val.textContent=(Math.round(cur*100)/100)+unit;
  r.addEventListener("input",function(){var v=+r.value;val.textContent=(Math.round(v*100)/100)+unit;onInput(v);});
  row.appendChild(head);row.appendChild(r);controls.appendChild(row);tagRow(row,modes);
}

/* 1) 보기 방식 — 최상위 스위치(항상·맨 위) */
seg(L("보기 방식","View"),[{label:L("책","Book"),val:"spread"},{label:L("페이지","Page"),val:"paged"},{label:L("연속","Scroll"),val:"flow"}],
  curView,function(v){ls(KEY+":view",v);setView(v);});  /* 저장 먼저 → setView 안 updateControlVis 가 새 값을 읽음 */

/* 2) 폭 — 1페이지 모드(연속/페이지): 단일 내용폭 */
function getWidePx(){var v=parseInt(ls(KEY+":widthpx")||"860",10);return (v>=600&&v<=1200)?v:860;}
function applyWide(px){root.style.setProperty("--wide",px+"px");root.style.setProperty("--maxw",(px-140)+"px");realignPager();}
applyWide(getWidePx());
rangeRow(L("폭","Width"),600,1200,20,"px",getWidePx,function(v){applyWide(v);ls(KEY+":widthpx",v);},["flow","paged"]);

/* 2') 책(2쪽) 전용 — 양옆 폭(바깥 여백)·가운데 폭(접지 간격)으로 분리 */
/* 양옆 폭 = dvw(뷰포트폭 비례). 기본 14.6dvw≈280px@1920. 단위 변경으로 구 px 키(:sppad)와 분리해 :sppadvw 사용. */
function getSpPad(){var v=parseFloat(ls(KEY+":sppadvw")||"14.6");return (v>=0&&v<=24)?v:14.6;}
function applySpPad(v){root.style.setProperty("--sp-pad",v+"dvw");realignPager();}
applySpPad(getSpPad());
rangeRow(L("양옆 폭","Side margin"),0,24,0.2,"dvw",getSpPad,function(v){applySpPad(v);ls(KEY+":sppadvw",v);},["spread"]);
/* 가운데 폭 = dvw. 기본 0.8dvw≈16px@1920. 구 px 키(:spgap)와 분리해 :spgapvw 사용. */
function getSpGap(){var v=parseFloat(ls(KEY+":spgapvw")||"0.8");return (v>=0&&v<=12)?v:0.8;}
function applySpGap(v){root.style.setProperty("--sp-gap",v+"dvw");realignPager();}
applySpGap(getSpGap());
rangeRow(L("가운데 폭","Center gap"),0,12,0.2,"dvw",getSpGap,function(v){applySpGap(v);ls(KEY+":spgapvw",v);},["spread"]);

/* 3) 상하 여백 — 세로 스크롤 모드(연속/페이지)만 */
function getGut(){var v=parseInt(ls(KEY+":gut")||"6",10);return (v>=0&&v<=20)?v:6;}
function applyGut(v){root.style.setProperty("--gut-top",v+"vh");root.style.setProperty("--gut-bottom",v+"vh");realignPager();}  /* pager 는 상하패딩 변경→세로 리플로우, 칼럼 경계 재정렬(no-op in flow) */
applyGut(getGut());
rangeRow(L("상하 여백","Vertical margin"),0,20,1,"vh",getGut,function(v){applyGut(v);ls(KEY+":gut",v);});  /* 전 모드: 연속=고정 거터 띠, 페이지/책=각 쪽 상하 패딩(--gut-top/bottom 공용) */

/* 4) 글자 크기 — 항상 */
var curFs=parseInt(ls(KEY+":fs")||"14",10);if(!(curFs>=8&&curFs<=30))curFs=14;applyFont(curFs);
rangeRow(L("글자 크기","Font size"),8,30,1,"px",function(){return curFs;},function(v){curFs=v;applyFont(v);ls(KEY+":fs",v);});

/* 5) 밝기 — 항상 */
seg(L("밝기","Theme"),[{label:L("시스템","System"),val:"system"},{label:L("밝게","Light"),val:"light"},{label:L("어둡게","Dark"),val:"dark"}],
  function(){return ls(KEY+":theme")||"system";},
  function(v){if(v==="system"){root.removeAttribute("data-theme");try{localStorage.removeItem(KEY+":theme");}catch(e){}}else{applyTheme(v);ls(KEY+":theme",v);}});

/* 6) 넘김 단위 — 연속 모드만(↑↓/← 이동량) */
seg(L("넘김 단위","Flip unit"),[{label:L("페이지","Page"),val:"page"},{label:L("스크롤","Scroll"),val:"scroll"}],
  function(){return ls(KEY+":step")||"page";},
  function(v){pageFactor=(v==="page")?0.85:0.5;ls(KEY+":step",v);},["flow"]);

var printBtn=el("button","ctl-full",L("🖨 인쇄 / PDF 저장","🖨 Print / Save as PDF"));printBtn.addEventListener("click",function(){window.print();});
controls.appendChild(printBtn);body.appendChild(controls);
updateControlVis();

/* FAB stack (bottom-right, two rows) */
var fabs=el("div","fab-stack");
var rowNav=el("div","fab-row");
var fbBack=el("button","fab nav","↩");fbBack.title="뒤로 (방문 기록)";fbBack.setAttribute("aria-label","뒤로");
var fbPrev=el("button","fab nav","‹");fbPrev.title="이전 페이지 (←)";fbPrev.setAttribute("aria-label","이전 페이지");
var fbNext=el("button","fab nav","›");fbNext.title="다음 페이지 (→)";fbNext.setAttribute("aria-label","다음 페이지");
rowNav.appendChild(fbBack);rowNav.appendChild(fbPrev);rowNav.appendChild(fbNext);
var rowMain=el("div","fab-row");
var fbToc=el("button","fab","☰");fbToc.title=_KO?"목차 (T)":"Contents (T)";fbToc.setAttribute("aria-label",_KO?"목차":"Contents");
var fbSet=el("button","fab","⚙");fbSet.title="읽기 설정";fbSet.setAttribute("aria-label","읽기 설정");
var fbTop=el("button","fab to-top","↑");fbTop.title="맨 위로";fbTop.setAttribute("aria-label","맨 위로");
rowMain.appendChild(fbToc);rowMain.appendChild(fbSet);rowMain.appendChild(fbTop);
fabs.appendChild(rowNav);fabs.appendChild(rowMain);body.appendChild(fabs);
/* FAB 평소엔 희미(본문 방해 최소) → 탭/호버/키보드 포커스 시 선명. 터치는 :hover 가 없으니 누를 때 awake 를 주고 2.5초 뒤 다시 희미.
   설정 패널·목차 서랍이 열려 있는 동안은 선명 유지(무엇을 눌렀는지 보이게). 버튼은 희미할 때도 첫 탭에 바로 동작. */
var fabWakeT=null;
function fabSleep(){if(controls.classList.contains("show")||drawer.classList.contains("show")){fabWakeT=setTimeout(fabSleep,2500);return;}fabs.classList.remove("awake");}
function fabWake(){fabs.classList.add("awake");clearTimeout(fabWakeT);fabWakeT=setTimeout(fabSleep,2500);}
fabs.addEventListener("pointerdown",fabWake);fabs.addEventListener("focusin",fabWake);
backBtnRef=fbBack;updateBack();
fbBack.addEventListener("click",goBack);
fbPrev.addEventListener("click",function(){goPage(-1);});
fbNext.addEventListener("click",function(){goPage(1);});
fbToc.addEventListener("click",function(){drawer.classList.contains("show")?closeDrawer():openDrawer();});
fbSet.addEventListener("click",function(e){e.stopPropagation();controls.classList.toggle("show");});
fbTop.addEventListener("click",function(){
  if(isPager()&&pageEl){var pv=pageEl.style.scrollBehavior;pageEl.style.scrollBehavior="auto";pageEl.scrollLeft=0;pageEl.style.scrollBehavior=pv;return;}  /* 페이저=첫 쪽(왼쪽 끝)으로 · 즉시(CSS smooth 우회, 먼 거리 스무스는 느림/불안정) */
  window.scrollTo({top:0,behavior:"smooth"});});
D.addEventListener("click",function(e){if(!controls.contains(e.target)&&e.target!==fbSet&&!fbSet.contains(e.target))controls.classList.remove("show");});
D.addEventListener("keydown",function(e){
  if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
  if(e.key==="t"||e.key==="T"){e.preventDefault();drawer.classList.contains("show")?closeDrawer():openDrawer();}  /* preventDefault=트리거 't'가 검색창에 입력되는 것 방지 */
});

/* scroll: progress, to-top, save pos */
var saveTimer=null;
function onScroll(){
  var h=D.documentElement;var max=h.scrollHeight-h.clientHeight;
  prog.style.width=((max>0?window.scrollY/max:0)*100)+"%";
  fbTop.classList.toggle("show",window.scrollY>600);
  updatePageInd();
  clearTimeout(saveTimer);saveTimer=setTimeout(function(){ls(KEY+":pos",Math.round(window.scrollY));},300);
}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();

/* active TOC highlight */
function updateActive(){
  var best=null,bestTop=1e9;
  [].forEach.call(D.querySelectorAll(".sec-head[id],.sub[id]"),function(h){
    var top=h.getBoundingClientRect().top;
    if(top<170){var d=170-top;if(d<bestTop){bestTop=d;best=h.id;}}
  });
  tocLinks.forEach(function(a){a.classList.toggle("active",!!best&&a.dataset.target===best);});
}
window.addEventListener("scroll",function(){requestAnimationFrame(updateActive);},{passive:true});updateActive();

/* resume: 저장 위치가 있으면 페인트 전에 "즉시(무애니)" 복원 → 열면 이미 그 자리(Kindle식).
   1초 뒤 자동 점프 같은 놀람 모션 대신, 토스트는 「처음부터」 탈출구만 제공(기본=이어읽음). */
if("scrollRestoration" in history)history.scrollRestoration="manual";
var saved=parseInt(ls(KEY+":pos")||"0",10);
if(saved>800 && saved<D.documentElement.scrollHeight-window.innerHeight-200){
  window.scrollTo(0,saved);   /* 즉시 복원(behavior 생략=auto=무애니) */
  onScroll();                 /* 진행바·맨위버튼 즉시 동기화 */
  var toast=el("div","toast");toast.innerHTML='<span>이어서 읽는 중</span>';
  var x=el("button","t-go","처음부터 ↑");
  toast.appendChild(x);body.appendChild(toast);
  setTimeout(function(){toast.classList.add("show");},400);
  x.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"});toast.classList.remove("show");});
  setTimeout(function(){toast.classList.remove("show");},6000);
}

/* 저장된 보기 방식 복원 + 화면 크기 바뀌면 페이지 경계 재정렬 */
setView(ls(KEY+":view")||defaultView());
window.addEventListener("resize",function(){if(isPager())realignPager();},{passive:true});
/* 가로 페이저(paged·spread): .page 가로 스크롤 → 페이지표시 갱신 + 휠 1노치 = 1페이지 넘김(쿨다운). */
if(pageEl){
  pageEl.addEventListener("scroll",function(){if(isPager())updatePageInd();},{passive:true});
  var wheelLock=false;
  pageEl.addEventListener("wheel",function(e){
    if(!isPager())return;
    e.preventDefault();if(wheelLock)return;
    var d=(Math.abs(e.deltaY)>=Math.abs(e.deltaX))?e.deltaY:e.deltaX;
    if(Math.abs(d)<4)return;
    wheelLock=true;goPage(d>0?1:-1);
    setTimeout(function(){wheelLock=false;},480);
  },{passive:false});
  /* 터치 스와이프(아이패드 등): 가로 페이저에서 좌/우 스와이프 = 한 페이지 넘김.
     드래그 중엔 손가락을 따라 움직이고(라이브), 뗄 때 ±1페이지(또는 제자리)로 스냅.
     네이티브 관성 자유스크롤을 막아 '조금씩 밀리는' 현상을 없앤다. 한 손가락만 처리(핀치줌 허용). */
  var tx=null,ty=null,tmoved=false;
  /* 스와이프는 document 에서 받는다 — 책 모드 양옆 여백(.page 밖)에서 시작한 스와이프도 넘김(탭 존과 동일 범위). 셸 UI 위 제스처는 제외. */
  var SWIPE_SKIP=".fab-stack,.controls,.drawer,.drawer-overlay,.lm-nav,.lightbox,.toast";
  D.addEventListener("touchstart",function(e){
    if(!isPager()||e.touches.length!==1||(e.target.closest&&e.target.closest(SWIPE_SKIP))){tx=null;return;}
    tx=e.touches[0].clientX;ty=e.touches[0].clientY;tmoved=false;
  },{passive:true});
  /* 끄는 동안: 글 띠는 그대로 두고 지금 쪽만 손가락 쪽으로 살짝(최대 80px) 밀리며 흐려짐 — 넘김 방향을 몸으로 느끼게 */
  var dragX=0,dragO=1;
  D.addEventListener("touchmove",function(e){
    if(!isPager()||tx===null||e.touches.length!==1)return;
    var dx=e.touches[0].clientX-tx,dy=e.touches[0].clientY-ty;
    if(!tmoved&&Math.abs(dy)>Math.abs(dx)){tx=null;return;} /* 세로 제스처면 양보 */
    tmoved=true;e.preventDefault();
    dragX=Math.max(-80,Math.min(80,dx*0.35));dragO=1-Math.min(0.5,Math.abs(dx)/700);
    pageEl.style.transform="translateX("+dragX+"px)";pageEl.style.opacity=String(dragO);
  },{passive:false});
  D.addEventListener("touchend",function(e){
    if(!isPager()||tx===null)return;
    var dx=e.changedTouches[0].clientX-tx;tx=null;
    if(!tmoved)return;
    var from={x:dragX,o:dragO},turned=false;
    if(Math.abs(dx)>40)turned=pagerGo(dx<0?1:-1,root.classList.contains("spread")?2:1,from);
    if(!turned&&pageEl.animate&&!REDUCE_MOTION)pageEl.animate([{transform:"translateX("+dragX+"px)",opacity:dragO},{transform:"translateX(0)",opacity:1}],{duration:160,easing:"ease-out"});  /* 제자리 복귀 */
    pageEl.style.transform="";pageEl.style.opacity="";dragX=0;dragO=1;  /* 애니메이션이 인라인보다 우선 → 걸고 나서 해제해도 튀지 않음 */
  },{passive:false});
  /* 가장자리 탭 넘김(터치 전용·페이저 전용) — 화면 왼쪽/오른쪽 TAP_ZONE 영역을 짧게 탭하면 이전/다음 쪽.
     document 에 건다: 책 모드의 양옆 여백은 .page 밖이라 pageEl 리스너로는 못 받음. 링크·버튼·그림·코드·셸 UI 위 탭과 텍스트 선택 중은 제외. */
  var TAP_ZONE=0.22,tapX=null,tapY=0,tapT=0;
  var TAP_SKIP="a,button,input,select,textarea,label,summary,img,video,svg,figure,pre,table,.fab-stack,.controls,.drawer,.drawer-overlay,.lm-nav,.lightbox,.toast,.page-ind";
  D.addEventListener("touchstart",function(e){tapX=(e.touches.length===1)?e.touches[0].clientX:null;if(tapX!==null){tapY=e.touches[0].clientY;tapT=Date.now();}},{passive:true});
  D.addEventListener("touchend",function(e){
    if(tapX===null||!isPager())return;
    var t=e.changedTouches[0],sx=tapX;tapX=null;
    if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-tapY)>10||Date.now()-tapT>350)return;  /* 드래그·길게 누름은 탭 아님 */
    if(e.target.closest&&e.target.closest(TAP_SKIP))return;
    var sel=window.getSelection&&window.getSelection();if(sel&&String(sel).length)return;
    var vw=window.innerWidth;
    if(t.clientX<vw*TAP_ZONE)goPage(-1);else if(t.clientX>vw*(1-TAP_ZONE))goPage(1);
  },{passive:true});
}
})();
