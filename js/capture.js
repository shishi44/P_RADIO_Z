import { APP_CONFIG } from "./config/appConfig.js?v=41";
import { getTemplateById } from "./config/templates.js?v=41";
import { loadResponses,clearResponseCache } from "./services/responseService.js?v=41";
import { loadSettings,getTemplateSettings,loadSelectedResponseId,saveSelectedResponseId } from "./services/settingsService.js?v=41";
import { loadConnection } from "./services/connectionService.js?v=41";
import { qs,setText,setHidden } from "./utils/dom.js?v=41";
import { renderResponse,applyTemplateStylesheet } from "./ui/responseRenderer.js?v=41";

const elements={
  stylesheet:qs("#template-stylesheet"),status:qs("#capture-status"),preview:qs("#capture-preview"),
  controls:qs("#capture-controls"),prev:qs("#capture-prev"),next:qs("#capture-next"),position:qs("#capture-position"),
  scrollUp:qs("#capture-scroll-up"),scrollDown:qs("#capture-scroll-down"),scrollHome:qs("#capture-scroll-home"),
  refresh:qs("#capture-refresh"),refreshState:qs("#capture-refresh-state")
};
const state={responses:[],index:-1,selectedId:"",settings:loadSettings(),connection:loadConnection(),timer:null,lastUpdated:null};
const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("pradio-z.capture.v1"):null;
const SELECTED_KEY="pradio-z.selected-response.v1",SETTINGS_KEY="pradio-z.settings.v1",CONNECTION_KEY="pradio-z.connection.v1",SYNC_KEY="pradio-z.capture-sync.v1";
let controlsTimer=0;

function hexToRgb(hex){const m=String(hex||"").match(/^#([0-9a-f]{6})$/i);if(!m)return null;const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255]}
function distance(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2)}
function chooseBackground(template){const candidates=["#00ff00","#0066ff","#ff00ff"];const colors=(template.previewColors||[]).map(hexToRgb).filter(Boolean);let best=candidates[0],score=-1;for(const candidate of candidates){const rgb=hexToRgb(candidate);const s=colors.length?Math.min(...colors.map(c=>distance(rgb,c))):0;if(s>score){score=s;best=candidate}}return best}
function showStatus(message){setText(elements.status,message||"");setHidden(elements.status,!message);setHidden(elements.preview,Boolean(message))}
function current(){return state.responses[state.index]||null}
function contentElement(){return elements.preview.querySelector(".response-content")}
function formatTime(date){return date?date.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"—"}
function showControls(){document.body.classList.add("capture-controls-visible");clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>{if(!elements.controls.matches(":hover")&&!elements.controls.contains(document.activeElement))document.body.classList.remove("capture-controls-visible")},2400)}
function updateControls(){const has=state.responses.length>0;elements.position.textContent=has?`${state.index+1} / ${state.responses.length}`:"— / —";elements.prev.disabled=!has||state.index<=0;elements.next.disabled=!has||state.index>=state.responses.length-1;elements.scrollUp.disabled=!has;elements.scrollDown.disabled=!has;elements.scrollHome.disabled=!has;elements.refreshState.textContent=state.connection.type==="sheet"?`自動更新 / ${formatTime(state.lastUpdated)}`:`手動更新 / ${formatTime(state.lastUpdated)}`}
function selectIndex(index,{resetScroll=true,persist=true}={}){if(!state.responses.length)return;state.index=Math.max(0,Math.min(state.responses.length-1,index));state.selectedId=current()?.id||"";if(persist&&state.selectedId)saveSelectedResponseId(state.selectedId);render({preserveScroll:!resetScroll,scrollTop:resetScroll?0:(contentElement()?.scrollTop||0)})}
function render({preserveScroll=false,scrollTop=0}={}){const response=current();if(!response){updateControls();return showStatus("表示できるお便りがありません。")}state.selectedId=response.id;state.settings=loadSettings();const template=getTemplateById(state.settings.templateId),values=getTemplateSettings(state.settings,template.id);document.body.style.setProperty("--capture-bg",chooseBackground(template));applyTemplateStylesheet(elements.stylesheet,template.id);renderResponse(elements.preview,response,{templateId:template.id,nameFontSize:values.nameFontSize,contentFontSize:values.contentFontSize,boldText:values.boldText,connection:state.connection});if(preserveScroll)contentElement()?.scrollTo({top:scrollTop});showStatus("");updateControls()}
function move(delta){selectIndex(state.index+delta,{resetScroll:true,persist:true})}
function scrollContent(delta){const content=contentElement();if(!content)return;content.scrollBy({top:delta,behavior:"smooth"});showControls()}
function scrollHome(){contentElement()?.scrollTo({top:0,behavior:"smooth"});showControls()}

async function load({force=false,preserve=true}={}){const previousId=state.selectedId||loadSelectedResponseId();const previousScroll=contentElement()?.scrollTop||0;try{elements.refresh.disabled=true;elements.refreshState.textContent="更新中…";if(force)clearResponseCache();state.connection=loadConnection();const payload=await loadResponses({connection:state.connection,force});state.responses=[...payload.responses];const requested=previousId||loadSelectedResponseId();const found=state.responses.findIndex(item=>item.id===requested);state.index=found>=0?found:(state.responses.length?Math.max(0,Math.min(state.index<0?0:state.index,state.responses.length-1)):-1);state.selectedId=current()?.id||"";state.lastUpdated=new Date();render({preserveScroll:preserve&&Boolean(previousId&&state.selectedId===previousId),scrollTop:previousScroll});setupAutoRefresh()}catch(error){console.error(error);showStatus(error.message||"お便りを読み込めませんでした。");elements.refreshState.textContent="更新失敗";updateControls()}finally{elements.refresh.disabled=false}}
function setupAutoRefresh(){if(state.timer){clearInterval(state.timer);state.timer=null}if(state.connection.type==="sheet")state.timer=setInterval(()=>load({force:true,preserve:true}),APP_CONFIG.sheetRefreshMs)}
function syncSelection(id){if(!id)return;const index=state.responses.findIndex(item=>item.id===String(id));if(index>=0){state.index=index;state.selectedId=String(id);render()}}
function syncScroll(top,id){if(id&&current()?.id!==id)syncSelection(id);contentElement()?.scrollTo({top:Number(top)||0})}

channel?.addEventListener("message",event=>{const data=event.data||{};if(data.type==="selection")syncSelection(data.id);if(data.type==="scroll")syncScroll(data.top,data.id);if(data.type==="settings")render({preserveScroll:true,scrollTop:contentElement()?.scrollTop||0})});
window.addEventListener("storage",event=>{if(event.key===SELECTED_KEY)syncSelection(loadSelectedResponseId());else if(event.key===SETTINGS_KEY)render({preserveScroll:true,scrollTop:contentElement()?.scrollTop||0});else if(event.key===CONNECTION_KEY)load({force:true,preserve:false});else if(event.key===SYNC_KEY){try{const data=JSON.parse(event.newValue||"{}");if(data.type==="scroll")syncScroll(data.top,data.id)}catch{}}});

elements.prev.addEventListener("click",()=>move(-1));
elements.next.addEventListener("click",()=>move(1));
elements.scrollUp.addEventListener("click",()=>scrollContent(-160));
elements.scrollDown.addEventListener("click",()=>scrollContent(160));
elements.scrollHome.addEventListener("click",scrollHome);
elements.refresh.addEventListener("click",()=>load({force:true,preserve:true}));
document.addEventListener("mousemove",showControls,{passive:true});
document.addEventListener("pointerdown",showControls,{passive:true});
document.addEventListener("keydown",event=>{if(event.target.matches("input,textarea,select"))return;if(event.key==="ArrowLeft"){event.preventDefault();move(-1)}else if(event.key==="ArrowRight"){event.preventDefault();move(1)}else if(event.key==="ArrowUp"){event.preventDefault();scrollContent(-160)}else if(event.key==="ArrowDown"){event.preventDefault();scrollContent(160)}else if(event.key==="Home"){event.preventDefault();scrollHome()}else if(event.key.toLowerCase()==="r"){event.preventDefault();load({force:true,preserve:true})}showControls()});
window.addEventListener("beforeunload",()=>{if(state.timer)clearInterval(state.timer);channel?.close()});
showControls();
load({force:true,preserve:false});
