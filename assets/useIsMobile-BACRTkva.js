import{c as s}from"./index-C4Q-S1LC.js";import{r as i}from"./vendor-react-Eidjb48W.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],h=s("external-link",a),w=()=>{const[o,r]=i.useState(()=>{const e=typeof window<"u"?window.innerWidth:1024,n=typeof window<"u"?window.innerHeight:768;return{isMobile:e<768,isTablet:e>=768&&e<1024,screenWidth:e,screenHeight:n,orientation:e<n?"portrait":"landscape"}});return i.useEffect(()=>{const e=()=>{const n=window.innerWidth,t=window.innerHeight;r({isMobile:n<768,isTablet:n>=768&&n<1024,screenWidth:n,screenHeight:t,orientation:n<t?"portrait":"landscape"})};return e(),window.addEventListener("resize",e),window.addEventListener("orientationchange",()=>{setTimeout(e,100)}),()=>{window.removeEventListener("resize",e),window.removeEventListener("orientationchange",e)}},[]),o};export{h as E,w as u};
