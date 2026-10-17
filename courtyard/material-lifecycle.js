export const RECYCLE_MS=12*60*60*1000;
export const isLibraryMaterial=material=>!material?.mural&&!material?.retired;
export const expiredMaterial=(material,now=Date.now())=>Number.isFinite(material?.deletedAt)&&now-material.deletedAt>=RECYCLE_MS;
