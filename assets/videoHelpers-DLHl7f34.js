import{c as o,a as i,ag as c}from"./index-CFEu2yfz.js";import{r as l,j as d}from"./vendor-react-_qAg71Oq.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],x=o("chevron-down",m);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],V=o("chevron-up",y);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]],D=o("play",g),E=c("bg-surface-subtle rounded-md",{variants:{pulse:{true:"motion-safe:animate-pulse",false:""}},defaultVariants:{pulse:!0}}),R=l.forwardRef(({className:t,pulse:e,as:a="div",...s},n)=>{const r=a;return d.jsx(r,{ref:n,"aria-hidden":"true",className:i(E({pulse:e}),t),...s})});R.displayName="Skeleton";const _=c("flex",{variants:{direction:{row:"flex-row",column:"flex-col"},gap:{0:"gap-0",1:"gap-1",2:"gap-2",3:"gap-3",4:"gap-4",5:"gap-5",6:"gap-6",8:"gap-8",10:"gap-10",12:"gap-12"},align:{start:"items-start",center:"items-center",end:"items-end",stretch:"items-stretch",baseline:"items-baseline"},justify:{start:"justify-start",center:"justify-center",end:"justify-end",between:"justify-between",around:"justify-around",evenly:"justify-evenly"},wrap:{true:"flex-wrap",false:""}},defaultVariants:{direction:"column",gap:4,align:"stretch",justify:"start",wrap:!1}}),w=l.forwardRef(({className:t,direction:e,gap:a,align:s,justify:n,wrap:r,...p},f)=>d.jsx("div",{ref:f,className:i(_({direction:e,gap:a,align:s,justify:n,wrap:r}),t),...p}));w.displayName="Stack";const u=t=>t.trim(),h=t=>t.map(u),v=t=>{try{const e=new URL(t),a=window.location.origin;return e.origin!==a}catch{return!1}},N=(t,e=[])=>({primary:u(t),fallbacks:h(e)}),b=(t,e)=>v(t)&&(!e||e.code===e.MEDIA_ERR_SRC_NOT_SUPPORTED||e.code===e.MEDIA_ERR_NETWORK),O=(t,e)=>{if(b(t,e))return"Video temporarily unavailable";if(e)switch(e.code){case e.MEDIA_ERR_ABORTED:return"Video loading was interrupted";case e.MEDIA_ERR_NETWORK:return"Network error loading video";case e.MEDIA_ERR_DECODE:return"Unable to play video format";case e.MEDIA_ERR_SRC_NOT_SUPPORTED:return"Video format not supported";default:return"Video temporarily unavailable"}return"Video temporarily unavailable"};export{V as C,D as P,R as S,w as a,x as b,O as c,N as g,u as t};
