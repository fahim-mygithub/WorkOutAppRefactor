import{c as d,b as u,L as x,u as r,at as y,bh as m,ao as p,bD as l,bE as h,bF as f,bG as R}from"./index-C46BZo2P.js";import{r as o}from"./vendor-react-B6UnZnM6.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],O=d("search",_);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]],v=d("trash-2",g),w=()=>{const s=u(),{user:e}=x(),{exercises:a,lastUpdated:i}=r(t=>t.exercise),c=r(y);return o.useEffect(()=>{a.length===0&&!i&&(async()=>{s(l(!0));try{const n=await h();s(f(n))}catch{s(R("Failed to load exercises. Please try again later."))}finally{s(l(!1))}})()},[s,a.length,i]),o.useEffect(()=>{e!=null&&e.uid&&s(m(e.uid))},[s,e==null?void 0:e.uid]),{exercises:o.useMemo(()=>p.mergeWithDatabaseExercises(a,c),[a,c]),databaseExercises:a,customExercises:c,isLoading:r(t=>t.exercise.isLoading),error:r(t=>t.exercise.error)}},E=s=>s.trim(),b=s=>s.map(E),D=s=>{try{const e=new URL(s),a=window.location.origin;return e.origin!==a}catch{return!1}},S=(s,e=[])=>({primary:E(s),fallbacks:b(e)}),k=(s,e)=>D(s)&&(!e||e.code===e.MEDIA_ERR_SRC_NOT_SUPPORTED||e.code===e.MEDIA_ERR_NETWORK),T=(s,e)=>{if(k(s,e))return"Video temporarily unavailable";if(e)switch(e.code){case e.MEDIA_ERR_ABORTED:return"Video loading was interrupted";case e.MEDIA_ERR_NETWORK:return"Network error loading video";case e.MEDIA_ERR_DECODE:return"Unable to play video format";case e.MEDIA_ERR_SRC_NOT_SUPPORTED:return"Video format not supported";default:return"Video temporarily unavailable"}return"Video temporarily unavailable"};export{O as S,v as T,T as a,S as g,E as t,w as u};
