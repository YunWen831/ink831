import express from 'express';
import {isLibraryMaterial,expiredMaterial} from '../../courtyard/material-lifecycle.js';
export function adminApi(accounts,worldStore,notify=()=>{}){
  const router=express.Router();
  router.use((req,res,next)=>{try{req.admin=accounts.requireAdmin(req.account?.hash);next();}catch{res.status(403).json({error:'需要管理员权限。'});}});
  const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(error){next(error);}};
  router.get('/users',handle(async(req,res)=>res.json({users:accounts.adminUsers(req.account.hash,req.query.search).map(u=>({...u,allowDemolition:worldStore.data.protection?.[u.id]===true}))})));
  router.get('/audit',handle(async(req,res)=>res.json({events:accounts.adminAudit(req.account.hash)})));
  router.post('/users/action',handle(async(req,res)=>res.json(await accounts.adminAction(req.account.hash,req.body?.id,req.body?.action,req.body))));
  const logged=async(req,target,action,note)=>{try{await accounts.recordAdminActor(req.admin.id,target,action,note);return {};}catch{return {warning:'操作已应用，记录暂未保存，请稍后检查。'};}};
  router.post('/protection',handle(async(req,res)=>{
    const {id,allow}=req.body||{};if(!accounts.data.users.some(u=>u.id===id))throw Error('账号不存在。');
    await worldStore.protect(id,allow,()=>accounts.requireAdmin(req.account.hash));notify({protection:{id,allow}});
    res.json({ok:true,...await logged(req,id,'protection',allow?'允许他人拆除':'保护建筑')});
  }));
  router.get('/materials',handle(async(req,res)=>{
    const owner=req.query.userId;res.json({materials:worldStore.data.materials.filter(m=>isLibraryMaterial(m)&&!expiredMaterial(m)&&(!owner||(owner==='legacy'?!m.ownerId:m.ownerId===owner))).map(({id,name,ownerId,author,deletedAt})=>({id,name,ownerId,ownerName:accounts.data.users.find(u=>u.id===ownerId)?.nickname||author||'未绑定旧作品',deletedAt:deletedAt||null}))});
  }));
  router.get('/materials/:id',handle(async(req,res)=>{const material=worldStore.data.materials.find(m=>m.id===req.params.id&&isLibraryMaterial(m)&&!expiredMaterial(m));if(!material)throw Error('作品不存在。');res.json({material});}));
  router.post('/materials/action',handle(async(req,res)=>{
    const {id,restore}=req.body||{};if(typeof restore!=='boolean')throw Error('操作不正确。');
    const material=await worldStore.deleteMaterial(id,req.admin.id,restore,()=>{accounts.requireAdmin(req.account.hash);return true;});
    notify({material});res.json({ok:true,...await logged(req,material.ownerId||'legacy',restore?'material-restore':'material-delete',material.name)});
  }));
  return router;
}
