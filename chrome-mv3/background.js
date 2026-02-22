var background=(function(){"use strict";function U(e){return e==null||typeof e=="function"?{main:e}:e}const _="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";async function g(e,t){const n=await fetch(`${_}?key=${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),a=await n.json().catch(()=>({}));if(!n.ok)throw new Error(a?.error?.message??`Gemini error ${n.status}`);return{data:a,ok:n.ok,status:n.status}}async function A(e,t,n){const a=[];t&&a.push({inlineData:{mimeType:"image/png",data:t}});const r=t?"the image above":`the following text: "${n}"`;a.push({text:`You are a precise claim-extraction engine. Analyze ${r} and identify the primary verifiable factual claim.

Respond ONLY with raw JSON (no markdown fences):
{
  "has_verifiable_claim": true or false,
  "claim": "the specific factual assertion (empty string if none)",
  "search_query": "optimal Google-style query to verify this claim (empty string if none)"
}

Rules:
- Opinions, satire, and questions are NOT verifiable claims → return false
- Quotes, statistics, historical facts, news assertions ARE verifiable
- Keep claim concise but complete enough to be checked`});const{data:s}=await g(e,{contents:[{role:"user",parts:a}],generationConfig:{responseMimeType:"application/json",temperature:.1}}),c=s.candidates?.[0]?.content?.parts?.[0]?.text??"{}";return JSON.parse(c)}async function k(e,t,n){const{data:a}=await g(e,{contents:[{role:"user",parts:[{text:`Search the web and fact-check this claim using real, current sources. Be thorough and objective.

CLAIM TO VERIFY: "${t}"
SEARCH QUERY: "${n}"

Instructions:
- Search for this claim across news outlets, fact-checkers, and community discussions including Reddit
- Describe what the sources say — both confirming and contradicting evidence
- Note if there is strong consensus or major disagreement across sources
- Be specific about what each source says`}]}],tools:[{googleSearch:{}}],generationConfig:{temperature:.1}}),r=a.candidates?.[0],s=r?.content?.parts?.map(i=>i.text??"").join("")??"",u=(r?.groundingMetadata?.groundingChunks??[]).filter(i=>i.web?.uri&&i.web?.title).map(i=>{const l=i.web;let o=l.title??"";o=o.replace(/^www\./,"").split("/")[0].trim();const m=o.toLowerCase().includes("reddit");return{title:l.title??o,url:l.uri,domain:o,type:m?"reddit":"news"}}).filter((i,l,o)=>o.findIndex(m=>m.domain===i.domain)===l).slice(0,6);return{summary:s,sources:u}}async function v(e,t,n,a){const r=a.length>0?a.map((o,m)=>`[${m}] ${o.title} (${o.domain})`).join(`
`):"None listed.",{data:s}=await g(e,{contents:[{role:"user",parts:[{text:`You are a strict, impartial fact-checking AI. Based on the research below, render a final structured verdict.

CLAIM: "${t}"

RESEARCH FROM WEB SOURCES:
${n}

SOURCES CITED IN RESEARCH:
${r}

Respond ONLY with raw JSON (no markdown fences):
{
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "UNVERIFIABLE",
  "confidence": number between 0-100,
  "summary": "2-3 sentence plain-English verdict explanation citing specific evidence",
  "sources_used": [0, 1, 2]
}

Verdict rules:
- TRUE: research clearly confirms the claim
- FALSE: research clearly contradicts the claim
- MISLEADING: technically true but missing crucial context that changes the meaning
- UNVERIFIABLE: insufficient or conflicting evidence — never guess, never fabricate
- confidence reflects evidence quality, not your prior beliefs
- sources_used must be 0-based indices into the SOURCES list above`}]}],generationConfig:{responseMimeType:"application/json",temperature:.1}}),c=s.candidates?.[0]?.content?.parts?.[0]?.text??"{}",u=JSON.parse(c),i=(u.sources_used??[]).filter(o=>typeof o=="number"&&o>=0&&o<a.length),l=i.length>0?i.map(o=>a[o]):a.slice(0,3);return{verdict:["TRUE","FALSE","MISLEADING","UNVERIFIABLE"].includes(u.verdict)?u.verdict:"UNVERIFIABLE",confidence:Math.min(100,Math.max(0,Math.round(u.confidence??0))),summary:u.summary??"Unable to analyze this claim.",sources:l,claim:t}}async function E(e,t,n,a){a("reading");const r=await A(e,t.imageBase64??null,t.text??null);if(!r.has_verifiable_claim||!r.claim)throw new Error("NO_CLAIM");a("searching");const{summary:s,sources:c}=await k(e,r.claim,r.search_query||r.claim);return a("analyzing"),{...await v(e,r.claim,s,c),timestamp:Date.now(),pageUrl:n.pageUrl,pageTitle:n.pageTitle}}const f="factcheck_history",b="api_keys",p="daily_usage";async function S(){return(await chrome.storage.local.get(b))[b]??null}async function x(){return(await chrome.storage.local.get(f))[f]??[]}async function T(e){const t=await x(),n=[e,...t].slice(0,100);await chrome.storage.local.set({[f]:n})}async function R(){const e=new Date().toDateString(),n=(await chrome.storage.local.get(p))[p]??{date:e,count:0},a=n.date===e?{date:e,count:n.count+1}:{date:e,count:1};return await chrome.storage.local.set({[p]:a}),a.count}const M=U(()=>{chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.create({id:"factcheck-selection",title:"Fact-check this",contexts:["selection"]})}),chrome.contextMenus.onClicked.addListener((e,t)=>{if(e.menuItemId!=="factcheck-selection"||!t?.id)return;const n=e.selectionText?.trim();n&&chrome.tabs.sendMessage(t.id,{type:"TRIGGER_TEXT_CHECK",text:n}).catch(()=>{})}),chrome.runtime.onMessage.addListener((e,t,n)=>{if(!t.tab?.id)return!1;const a=t.tab.id;return e.type==="CAPTURE_REQUEST"?(N(a,e.selectionRect,e.dpr,e.pageUrl,e.pageTitle),n({ok:!0}),!1):(e.type==="CHECK_TEXT_REQUEST"&&(O(a,e.text,e.pageUrl,e.pageTitle),n({ok:!0})),!1)})});async function L(e,t,n){const r=await(await fetch(e)).blob(),s=await createImageBitmap(r),c=Math.round(t.x*n),u=Math.round(t.y*n),i=Math.round(t.width*n),l=Math.round(t.height*n),o=new OffscreenCanvas(i,l);o.getContext("2d").drawImage(s,c,u,i,l,0,0,i,l),s.close();const Y=await(await o.convertToBlob({type:"image/png"})).arrayBuffer(),I=new Uint8Array(Y);let C="";for(let w=0;w<I.byteLength;w++)C+=String.fromCharCode(I[w]);return btoa(C)}function d(e,t){chrome.tabs.sendMessage(e,t).catch(()=>{})}async function N(e,t,n,a,r){try{const s=await S();if(!s?.gemini){d(e,{type:"ERROR",message:"API_KEYS_MISSING"});return}const c=await chrome.tabs.captureVisibleTab({format:"png"}),u=await L(c,t,n),i=await E(s.gemini,{imageBase64:u},{pageUrl:a,pageTitle:r},m=>d(e,{type:"STATUS_UPDATE",status:m})),l=crypto.randomUUID(),o={...i,id:l};await T(o),await R(),d(e,{type:"RESULT",result:o,position:t})}catch(s){const c=s instanceof Error?s.message:"Unknown error";d(e,{type:"ERROR",message:c==="NO_CLAIM"?"NO_CLAIM":c})}}async function O(e,t,n,a){try{const r=await S();if(!r?.gemini){d(e,{type:"ERROR",message:"API_KEYS_MISSING"});return}const s=await E(r.gemini,{text:t},{pageUrl:n,pageTitle:a},i=>d(e,{type:"STATUS_UPDATE",status:i})),c=crypto.randomUUID(),u={...s,id:c};await T(u),await R(),d(e,{type:"TEXT_RESULT",result:u})}catch(r){const s=r instanceof Error?r.message:"Unknown error";d(e,{type:"ERROR",message:s==="NO_CLAIM"?"NO_CLAIM":s})}}function $(){}globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function h(e,...t){}const B={debug:(...e)=>h(console.debug,...e),log:(...e)=>h(console.log,...e),warn:(...e)=>h(console.warn,...e),error:(...e)=>h(console.error,...e)};let y;try{y=M.main(),y instanceof Promise&&console.warn("The background's main() function return a promise, but it must be synchronous")}catch(e){throw B.error("The background crashed on startup!"),e}var D=y;return D})();
