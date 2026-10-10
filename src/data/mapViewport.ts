export function mapViewport(width: number, height: number, overlays?: {top: number; bottom: number}) {
  // Reserve the panel once, keeping route geometry and map attribution visible.
  return {
    mapPadding:{top:0,left:0,right:0,bottom:Math.round(overlays?.bottom ?? height*0.405)},
    edgePadding:{top:Math.round(overlays?.top ?? height*0.19),left:Math.round(width*0.12),right:Math.round(width*0.12),bottom:overlays ? 24 : Math.round(height*0.055)},
  };
}
