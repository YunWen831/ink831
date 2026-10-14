package cn.kecheng.assistant;
import org.json.*;
public class ImportCodecTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}
 static String raw(String courses){return "{\"format\":\"course-table\",\"version\":1,\"courses\":["+courses+"]}";}
 static String good(){return "{\"name\":\"高等数学\",\"location\":\"A302\",\"weekday\":3,\"start\":\"10:00\",\"end\":\"11:35\",\"weeks\":[1,3,5],\"note\":\"带习题册\"}";}
 public static void main(String[] args)throws Exception {
  JSONArray periods=new JSONArray("[{\"start\":\"08:00\",\"end\":\"08:45\"},{\"start\":\"08:55\",\"end\":\"09:40\"}]");
  ImportCodec.Result a=ImportCodec.parse("识别结果：\n```json\n"+raw(good())+"\n```",20,periods);check(a.valid.size()==1&&a.issues.isEmpty(),"提取代码块");check(a.valid.get(0).note.equals("带习题册"),"中文备注保留");
  String quotes=good().replace("带习题册","备注里有 { 和 } 以及 \\\"引号\\\"");check(ImportCodec.parse(raw(quotes),20,periods).valid.size()==1,"字符串花括号不截断");
  String unknown=good().replace("\"A302\"","null");ImportCodec.Result partial=ImportCodec.parse(raw(good()+","+unknown),20,periods);check(partial.valid.size()==1&&partial.issues.size()==1&&partial.pending.size()==1&&partial.pending.get(0).getString("name").equals("高等数学"),"缺失字段提示并保留原数据以便补充");
  String lesson=good().replace("\"10:00\"","null").replace("\"11:35\"","null").replace("\"note\":","\"lesson_start\":1,\"lesson_end\":2,\"note\":");check(ImportCodec.parse(raw(lesson),20,periods).valid.get(0).end==580,"节次换算");check(ImportCodec.parse(raw(lesson),20,new JSONArray()).issues.size()==1,"没有作息不猜测");
  check(ImportCodec.parse(raw(good().replace("\"note\":","\"uncertain\":[\"地点\"],\"note\":")),20,periods).issues.size()==1,"不确定字段需核对");
  for(String c:new String[]{good().replace("\"weekday\":3","\"weekday\":3.5"),good().replace("[1,3,5]","[0]"),good().replace("[1,3,5]","[21]"),good().replace("[1,3,5]","[\"1\"]"),good().replace("11:35","09:00"),good().replace("10:00","24:00"),good().replace("[1,3,5]","[]")})check(ImportCodec.parse(raw(c),20,periods).issues.size()==1,"拒绝非法课程");
  for(String bad:new String[]{"abc",raw(good())+raw(good()),raw(good()).replace("\"version\":1","\"version\":2"),raw(good()).replace("course-table","other"),raw(good()).substring(0,50),raw("")}){boolean failed=false;try{ImportCodec.parse(bad,20,periods);}catch(Exception e){failed=true;}check(failed,"拒绝非法输入");}
  Course copy=Store.parseCourse(new JSONObject(good()),20);check(Store.parseCourse(Store.courseJson(copy,true),20).fingerprint().equals(copy.fingerprint()),"持久化往返");
  Course.Change x=new Course.Change();x.cancelled=true;x.date=java.time.LocalDate.of(2026,10,14);x.start=600;x.end=695;x.location="A302";copy.changes.put(x.date,x);Course restored=Store.parseCourse(Store.courseJson(copy,true),20);check(restored.changes.get(x.date).cancelled,"单次停课往返");
  java.time.LocalDate monday=java.time.LocalDate.of(2026,10,12);Semester legacy=Store.readCalendar(new JSONObject().put("semester",monday.toString()).put("total",20),monday);check(legacy.opening.equals(monday)&&legacy.holiday.equals(monday.plusWeeks(20)),"旧版学期数据兼容");
  Semester changed=Store.readCalendar(new JSONObject().put("semester","2026-08-31").put("total",3).put("opening","2026-09-01").put("holiday","2026-09-16"),monday);check(changed.opening.getDayOfWeek()==java.time.DayOfWeek.TUESDAY&&changed.weeks==3,"新版非周一日期读取");
  boolean invalid=false;try{Store.readCalendar(new JSONObject().put("opening","2026-09-16").put("holiday","2026-09-01"),monday);}catch(Exception e){invalid=true;}check(invalid,"备份日期倒置不恢复");
  System.out.println("Import codec passed: "+count+" assertions");
 }
}
