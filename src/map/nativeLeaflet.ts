import {leafletCSS, leafletJS} from './leafletAssets';

export function nativeMapHTML(generation = 0) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${leafletCSS}
  html,body,#map{margin:0;width:100%;height:100%;background:#080f10;font-family:sans-serif}
  .leaflet-tile-pane{filter:invert(1) hue-rotate(160deg) saturate(.55) brightness(.8)}
  .leaflet-control-attribution{background:#080f10e6;color:#b8f28b;font-size:10px}.leaflet-control-attribution a{color:#8dd8af}
  .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#191919;color:white}
  .pin{display:block;width:22px;height:22px;border:2px solid #080f10;border-radius:50%;box-shadow:0 2px 5px #0008}
  #error{position:absolute;top:90px;left:12px;right:12px;z-index:1000;color:#dbe7d7;background:#19221ce8;padding:10px;display:none}
  #retry{display:block;min-height:48px;min-width:48px;background:none;border:0;color:#9be570;font:inherit}#retry:disabled{opacity:.5}
  </style></head><body><div id="map"></div><div id="error" role="status"><span id="tile-message"></span> Loaded routes remain usable.<button id="retry">Retry tiles</button></div>
  <script>
  window.pathfinderBridge=(()=>{
    let active=true;
    const send=data=>{if(active&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({...data,generation:${generation}}));};
    const error=()=>send({type:'error'});
    window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
    return {send,dispose(){active=false;window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);}};
  })();
  </script><script data-leaflet>${leafletJS.replace(/<\/script/gi, '<\\/script')}</script><script>
  (()=>{try{
    const send=window.pathfinderBridge.send;
    const map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:.25}).setView([14.6234,121.1448],13);
    map.attributionControl.setPrefix(false);
    const failed=new Set(),error=document.getElementById('error'),retry=document.getElementById('retry');
    let retryTimer,disposed=false;
    const showErrors=()=>{error.style.display=failed.size?'block':'none';document.getElementById('tile-message').textContent=failed.size+' map tile'+(failed.size===1?' is':'s are')+' unavailable.';};
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:0,updateWhenIdle:true,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap">Fix the map</a>'});
    tiles.on('tileerror',e=>{failed.add(e.tile);showErrors();}).on('tileload tileunload',e=>{failed.delete(e.tile);showErrors();}).addTo(map);
    retry.onclick=()=>{if(retry.disabled||!failed.size||disposed)return;retry.disabled=true;
      // Retry only failed visible tiles, keeping the original URL and browser HTTP cache.
      [...failed].forEach(tile=>{if(tile.isConnected)tile.src=tile.src;else failed.delete(tile);});showErrors();
      retryTimer=setTimeout(()=>{retry.disabled=false;},5000);
    };
    const layers=L.layerGroup().addTo(map),endpoints=L.layerGroup().addTo(map),gps=L.layerGroup().addTo(map),lines=new Map();
    let state={routes:[],top:84,bottom:200},routeKey='',gpsKey='',roadCredit=false,originMarker,destinationMarker;
    const point=p=>[p.latitude,p.longitude];
    const popup=(title,detail)=>{const div=document.createElement('div'),b=document.createElement('strong'),p=document.createElement('p');b.textContent=title;p.textContent=detail;div.append(b,p);return div;};
    function fit(){if(disposed)return;const r=state.routes.find(r=>r.id===state.selected);if(!r)return;
      map.stop();map.flyToBounds(L.latLngBounds(r.coordinates.map(point)),{paddingTopLeft:[24,state.top],paddingBottomRight:[24,state.bottom+24],maxZoom:16,animate:!state.reduced,duration:.6});}
    function marker(p,color,title,detail,group=layers){return L.marker(point(p),{title,alt:title,icon:L.divIcon({html:'<span class="pin" style="background:'+color+'"></span>',className:'',iconSize:[26,26],iconAnchor:[13,13]})}).bindPopup(popup(title,detail),{autoPan:false}).addTo(group);}
    function endpoint(existing,p,color,title,detail){
      if(!existing)return marker(p,color,title,detail,endpoints);
      existing.setLatLng(point(p)).setPopupContent(popup(title,detail));
      existing.options.title=title;existing.options.alt=title;const icon=existing.getElement();if(icon){icon.title=title;icon.setAttribute('alt',title);}return existing;
    }
    window.pathfinder={update(next){
      if(disposed)return;
      const previous=state;state={...state,...next};
      document.querySelector('.leaflet-bottom').style.bottom=state.bottom+'px';map.invalidateSize({pan:false});
      const road=state.routes.some(r=>r.road),credit='Routing: <a href="https://project-osrm.org">OSRM</a>';
      if(road!==roadCredit){map.attributionControl[road?'addAttribution':'removeAttribution'](credit);roadCredit=road;}
      const key=next.routes?JSON.stringify(next.routes):routeKey,changed=key!==routeKey;
      if(changed){routeKey=key;layers.clearLayers();lines.clear();
        state.routes.forEach((r,i)=>{
          const line=L.polyline(r.coordinates.map(point),{color:r.color,weight:5}).addTo(layers).on('click',()=>send({type:'select',id:r.id}));lines.set(r.id,line);
          const p=r.coordinates[Math.min(r.coordinates.length-1,r.road?Math.floor(r.coordinates.length*(.35+i*.15)):8+i*5)];
          marker(p,r.color,r.label+(r.road?' · Driving':' · Sample'),r.summary).on('click',()=>send({type:'select',id:r.id}));
        });
      }
      if(changed||previous.selected!==state.selected||previous.reversed!==state.reversed){
        [...state.routes.filter(r=>r.id!==state.selected),...state.routes.filter(r=>r.id===state.selected)].forEach((r,i)=>{
          const selected=r.id===state.selected;lines.get(r.id)?.setStyle({color:r.road?(selected?'#7ed957':'#8b9690'):r.color,weight:r.road?(selected?6:5):(selected?5:i===0?13:9),opacity:selected?1:.55}).bringToFront();
        });
        const r=state.routes.find(r=>r.id===state.selected);if(r){const points=state.reversed&&!r.road?[...r.coordinates].reverse():r.coordinates;
          originMarker=endpoint(originMarker,points[0],'#1d9ee3','Origin: '+(r.endpoints?.origin??(state.reversed&&!r.road?r.destination:r.origin)),r.road?'Road-snapped driving origin':'Demo origin, not GPS');
          destinationMarker=endpoint(destinationMarker,points[points.length-1],'#7ed957','Destination: '+(r.endpoints?.destination??(state.reversed&&!r.road?r.origin:r.destination)),r.road?'Road-snapped driving destination':'Demo destination');
        }else{endpoints.clearLayers();originMarker=destinationMarker=undefined;}
      }
      if(changed||previous.selected!==state.selected||previous.top!==state.top||previous.bottom!==state.bottom)fit();
      const locationKey=JSON.stringify(state.location??null);
      if(locationKey!==gpsKey){gpsKey=locationKey;gps.clearLayers();if(state.location){const p=state.location;
        if(p.accuracy!==null)L.circle(point(p),{radius:p.accuracy,color:'#53b8ff',weight:1,fillOpacity:.08,interactive:false}).addTo(gps);
        L.circleMarker(point(p),{radius:8,color:'#fff',weight:2,fillColor:'#259cff',fillOpacity:1}).addTo(gps).bindPopup(popup('Your GPS position','Last fix: '+new Date(p.timestamp).toLocaleTimeString()));}}
    },fit,locate(p){if(!disposed)map.flyTo(point(p),16,{animate:!state.reduced,duration:.6});},resume(){if(!disposed)map.invalidateSize({pan:false});},dispose};
    function dispose(){if(disposed)return;disposed=true;clearTimeout(retryTimer);retry.onclick=null;tiles.off();map.remove();failed.clear();lines.clear();window.removeEventListener('pagehide',dispose);window.pathfinderBridge.dispose();}
    window.addEventListener('pagehide',dispose);
    send({type:'ready'});
  }catch{window.pathfinderBridge.send({type:'error'});}})();
  </script></body></html>`;
}
