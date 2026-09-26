import{c as o,b as y,d as f,u as j,U as N,V as b,W as g,B as u}from"./index-D6wP7OFl.js";import{h as w,u as m,r as h,j as e}from"./vendor-react-Eidjb48W.js";import{A as v}from"./arrow-left-Lr9O2jpp.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],_=o("circle-alert",S);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],z=o("copy",L);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],G=o("link-2",A);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],W=o("loader-circle",M);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],V=o("save",C);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],B=o("undo-2",E),D=({children:l,onWorkoutNotFound:t})=>{const{shareId:s}=w();m();const a=y(),{user:n}=f(),{currentSharedWorkout:i,isLoadingShared:r,shareError:c}=j(k=>k.sharedWorkout),[d,p]=h.useState(!1);return h.useEffect(()=>(s&&!d&&(p(!0),a(N(s)),n||a(b(!0))),()=>{s||a(g())}),[s,d,n,a]),h.useEffect(()=>{c&&!r&&d&&t&&t()},[c,r,d,t]),s?r?e.jsx(H,{}):c?e.jsx(x,{message:c,shareId:s}):i?e.jsx(e.Fragment,{children:l(i)}):e.jsx(x,{message:"Workout not found or has expired",shareId:s}):e.jsx(x,{message:"Invalid share link - no workout ID found"})},H=()=>e.jsx("div",{className:"flex min-h-full items-center bg-surface px-4",children:e.jsxs("div",{className:"mx-auto w-full max-w-sm","aria-busy":"true","aria-live":"polite",children:[e.jsxs("p",{className:"flex items-center gap-2 text-body-sm text-ink-muted",children:[e.jsx(W,{className:"h-4 w-4 animate-spin","aria-hidden":"true"}),"Shared workout"]}),e.jsx("h2",{className:"mt-1 font-display text-display text-ink",children:"Loading"}),e.jsx("p",{className:"mt-3 text-body text-ink-muted",children:"Fetching the workout someone shared with you."})]})}),x=({message:l,shareId:t})=>{const s=m(),a=()=>{s("/")},n=()=>{s(-1)},i=["The link is incomplete or mistyped","Its creator deleted the workout","The link has expired","The connection dropped while loading"];return e.jsx("div",{className:"min-h-full bg-surface px-4 pb-8 pt-10",children:e.jsxs("div",{className:"mx-auto w-full max-w-sm",role:"alert",children:[e.jsxs("p",{className:"flex items-center gap-2 text-body-sm text-danger",children:[e.jsx(_,{className:"h-4 w-4","aria-hidden":"true"}),"Shared workout"]}),e.jsx("h2",{className:"mt-1 font-display text-display text-ink",children:"Workout not found"}),e.jsx("p",{className:"mt-3 text-body text-ink-muted",children:l}),e.jsxs("div",{className:"mt-6 rounded-[20px] bg-surface-subtle px-4 py-2",children:[e.jsx("p",{className:"pt-2 text-body-sm font-semibold text-ink",children:"This can happen when"}),e.jsx("ul",{className:"divide-y divide-hairline text-body-sm text-ink-muted",children:i.map(r=>e.jsx("li",{className:"py-2.5",children:r},r))}),t&&e.jsxs("p",{className:"border-t border-hairline py-2.5 text-caption text-ink-subtle",children:["Share ID ",e.jsx("span",{className:"break-all font-mono text-ink-muted",children:t})]})]}),e.jsxs("div",{className:"mt-8 space-y-2",children:[e.jsx(u,{size:"xl",onClick:a,children:"Go to Today"}),e.jsxs(u,{variant:"ghost",className:"w-full",onClick:n,children:[e.jsx(v,{className:"h-4 w-4","aria-hidden":"true"}),"Go back"]})]}),e.jsx("p",{className:"mt-6 text-caption text-ink-subtle",children:"Need help? Ask the person who shared it for a new link."})]})})};export{z as C,G as L,V as S,B as U,D as a,W as b};
