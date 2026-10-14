package cn.kecheng.assistant;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

public final class DetailsDataTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}
 static JSONObject good()throws Exception{return new JSONObject("{\"name\":\"数学\",\"location\":\"A302\",\"weekday\":3,\"start\":null,\"end\":null,\"lesson_start\":1,\"lesson_end\":2,\"weeks\":[1,3],\"note\":\"带书\"}");}
 static JSONArray periods(String start,String end)throws Exception{return new JSONArray().put(new JSONObject().put("start",start).put("end","08:45")).put(new JSONObject().put("start","08:55").put("end",end));}
 static JSONObject data()throws Exception{return new JSONObject().put("format","course-assistant-backup").put("version",1).put("semester","2026-10-12").put("total",20).put("courses",new JSONArray());}
 static byte[] zip(Map<String,byte[]> entries)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();try(ZipOutputStream zip=new ZipOutputStream(out)){for(Map.Entry<String,byte[]> e:entries.entrySet()){zip.putNextEntry(new ZipEntry(e.getKey()));zip.write(e.getValue());zip.closeEntry();}}return out.toByteArray();}
 public static void main(String[] args)throws Exception{
  ImportDraft draft=new ImportDraft();draft.raw=new JSONObject().put("format","course-table").put("version",1).put("courses",new JSONArray().put(good())).toString();draft.preview=ImportCodec.parse(draft.raw,20,new JSONArray());check(draft.preview.pending.size()==1,"缺少作息时暂存待核对条目");
  draft.reconcile(20,periods("08:00","09:40"));check(draft.preview.pending.isEmpty()&&draft.preview.valid.get(0).start==480&&draft.preview.valid.get(0).end==580,"补充作息后自动换算，无需找AI或重贴");
  Course original=draft.preview.valid.get(0);original.name="数学（修订）";original.location="B408";original.note="我的补充备注";original.weeks.clear();original.weeks.add(5);String id=original.id;draft=ImportDraft.read(new JSONObject(draft.json().toString()));draft.reconcile(20,periods("08:10","09:50"));Course updated=draft.preview.valid.get(0);check(updated.id.equals(id)&&updated.start==490&&updated.end==590,"持久化后仍能更新节次时间");check(updated.name.equals("数学（修订）")&&updated.location.equals("B408")&&updated.note.equals("我的补充备注")&&updated.weeks.contains(5),"重新换算不覆盖其他手动字段");
  draft.preview.lessonSources.remove(updated.id);updated.start=600;updated.end=660;draft.reconcile(20,periods("08:20","10:00"));check(draft.preview.valid.get(0).start==600,"手动修改时间后不再自动覆盖");
  JSONObject uncertain=good().put("uncertain",new JSONArray().put("地点"));ImportDraft waiting=new ImportDraft();waiting.preview=ImportDraft.one(uncertain,20,new JSONArray());waiting.reconcile(20,periods("08:00","09:40"));check(waiting.preview.valid.isEmpty()&&waiting.preview.pending.size()==1,"不确定字段仍需用户核对，不猜填");
  ImportDraft missing=new ImportDraft();missing.preview=ImportDraft.one(good(),20,periods("08:00","09:40"));missing.reconcile(20,new JSONArray());check(missing.preview.valid.isEmpty()&&missing.preview.pending.size()==1,"移除作息后旧换算不会继续作为有效课程");
  ImportDraft deleted=new ImportDraft();deleted.preview=ImportDraft.one(good(),20,new JSONArray());deleted.removePending(0);deleted.reconcile(20,periods("08:00","09:40"));check(deleted.preview.valid.isEmpty(),"已删除条目不会重新出现");
  Map<String,byte[]> assets=new LinkedHashMap<>();assets.put("background.png",new byte[]{1,2,3});assets.put("drawing-draft.json",new SketchModel().json().toString().getBytes(StandardCharsets.UTF_8));assets.put("import-draft.json",draft.json().toString().getBytes(StandardCharsets.UTF_8));assets.put("reference.png",new byte[]{4,5});
  BackupArchive.Content bundle=new BackupArchive.Content(data(),assets,Arrays.asList("对照图来自本机"),true);boolean[] closed={false};ByteArrayOutputStream out=new ByteArrayOutputStream(){public void close(){closed[0]=true;}};BackupArchive.write(out,bundle);BackupArchive.Content read=BackupArchive.read(new ByteArrayInputStream(out.toByteArray()));check(read.portable&&read.assets.size()==4&&Arrays.equals(read.assets.get("background.png"),assets.get("background.png")),"完整备份保留资源原字节");check(read.warnings.equals(bundle.warnings)&&ImportDraft.read(new JSONObject(new String(read.assets.get("import-draft.json"),StandardCharsets.UTF_8))).preview.valid.get(0).start==600,"导入修改与资源提示随备份保留");
  BackupArchive.Content legacy=BackupArchive.read(new ByteArrayInputStream(data().toString().getBytes(StandardCharsets.UTF_8)));check(!legacy.portable&&legacy.assets.isEmpty(),"旧JSON副本仍可读取");
  JSONObject manifest=new JSONObject().put("format","course-assistant-backup").put("version",2).put("data",data()).put("assets",new JSONArray().put("background.png"));Map<String,byte[]> malformed=new LinkedHashMap<>();malformed.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));
  boolean rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"缺失清单中的资源不允许恢复");
  malformed.put("background.png",new byte[]{1,2,3});manifest.put("assets",new JSONArray().put("background.png").put("background.png"));malformed.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"重复资源声明拒绝恢复");
  manifest.put("assets",new JSONArray());malformed.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"未声明的资源拒绝恢复");
  malformed.put("../drawing-draft.json",new byte[]{1});rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"拒绝路径穿越，不进行任意文件解压");
  malformed.clear();malformed.put("background.png",new byte[]{1});rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"缺失清单拒绝恢复");
  malformed.clear();manifest.put("assets",new JSONArray()).put("version",9);malformed.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"拒绝未知版本");
  manifest.put("version",2).put("assets",new JSONArray().put("drawing-draft.json"));malformed.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));malformed.put("drawing-draft.json","broken".getBytes(StandardCharsets.UTF_8));rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(malformed)));}catch(Exception e){rejected=true;}check(rejected,"损坏画布在修改数据前被拒绝");
  Map<String,byte[]> huge=new LinkedHashMap<>();manifest.put("assets",new JSONArray().put("import-draft.json"));huge.put("manifest.json",manifest.toString().getBytes(StandardCharsets.UTF_8));huge.put("import-draft.json",new byte[4*1024*1024+1]);rejected=false;try{BackupArchive.read(new ByteArrayInputStream(zip(huge)));}catch(Exception e){rejected=true;}check(rejected,"解压资源有大小限制");
  check(!closed[0],"写备份后调用方输出流仍可用于提交文件");
  QuickBarConfig oldDefault=QuickBarConfig.read(new JSONObject());check(oldDefault.enabled&&!oldDefault.items.contains("weather")&&oldDefault.items.contains("wood"),"升级保留旧版工具开启、天气关闭状态");
  QuickBarConfig oldOff=QuickBarConfig.read(new JSONObject().put("weather",false).put("tools",false));check(!oldOff.enabled&&oldOff.items.isEmpty(),"旧版全部关闭时不会擅自开启小栏");
  QuickBarConfig weatherOnly=QuickBarConfig.read(new JSONObject().put("weather",true).put("tools",false));check(weatherOnly.enabled&&weatherOnly.items.equals(Arrays.asList("weather")),"旧版仅天气开启时保留选择");
  QuickBarConfig selected=QuickBarConfig.read(new JSONObject().put("quickBarItems",new JSONArray().put("wood").put("weather").put("dice")).put("quickBarEnabled",false));check(selected.items.equals(Arrays.asList("wood","weather","dice")),"用户自定义排序不被默认排序覆盖");
  QuickBarConfig saved=QuickBarConfig.read(selected.json());check(!saved.enabled&&saved.items.equals(selected.items),"关闭小栏不丢失选择，备份往返保留顺序");
  QuickBarConfig clean=QuickBarConfig.read(new JSONObject().put("quickBarItems",new JSONArray().put("dice").put("unknown").put("dice").put("weather")));check(clean.items.equals(Arrays.asList("dice","weather")),"未知内容和重复项不会混入小栏");
  QuickBarConfig empty=QuickBarConfig.read(new JSONObject().put("quickBarItems",new JSONArray()));check(empty.items.isEmpty(),"主动取消全部勾选时不恢复默认工具");
  System.out.println("Details data passed: "+count+" assertions");
 }
}
