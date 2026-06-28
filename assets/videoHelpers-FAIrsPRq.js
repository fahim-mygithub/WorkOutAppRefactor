import{c as n,a as d,a0 as u}from"./index-C4Q-S1LC.js";import{r as p,j as f}from"./vendor-react-Eidjb48W.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],j=n("chevron-down",y);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],x=n("chevron-up",m);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]],D=n("play",E),g=u("flex",{variants:{direction:{row:"flex-row",column:"flex-col"},gap:{0:"gap-0",1:"gap-1",2:"gap-2",3:"gap-3",4:"gap-4",5:"gap-5",6:"gap-6",8:"gap-8",10:"gap-10",12:"gap-12"},align:{start:"items-start",center:"items-center",end:"items-end",stretch:"items-stretch",baseline:"items-baseline"},justify:{start:"justify-start",center:"justify-center",end:"justify-end",between:"justify-between",around:"justify-around",evenly:"justify-evenly"},wrap:{true:"flex-wrap",false:""}},defaultVariants:{direction:"column",gap:4,align:"stretch",justify:"start",wrap:!1}}),R=p.forwardRef(({className:e,direction:t,gap:a,align:s,justify:o,wrap:i,...c},l)=>f.jsx("div",{ref:l,className:d(g({direction:t,gap:a,align:s,justify:o,wrap:i}),e),...c}));R.displayName="Stack";const r=e=>e.trim(),_=e=>e.map(r),w=e=>{try{const t=new URL(e),a=window.location.origin;return t.origin!==a}catch{return!1}},k=(e,t=[])=>({primary:r(e),fallbacks:_(t)}),h=(e,t)=>w(e)&&(!t||t.code===t.MEDIA_ERR_SRC_NOT_SUPPORTED||t.code===t.MEDIA_ERR_NETWORK),V=(e,t)=>{if(h(e,t))return"Video temporarily unavailable";if(t)switch(t.code){case t.MEDIA_ERR_ABORTED:return"Video loading was interrupted";case t.MEDIA_ERR_NETWORK:return"Network error loading video";case t.MEDIA_ERR_DECODE:return"Unable to play video format";case t.MEDIA_ERR_SRC_NOT_SUPPORTED:return"Video format not supported";default:return"Video temporarily unavailable"}return"Video temporarily unavailable"};export{x as C,D as P,R as S,j as a,V as b,k as g,r as t};
