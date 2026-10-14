package cn.kecheng.assistant;
import org.json.*;
public final class DraftAndSketchTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}
 static String good(){return "{\"format\":\"course-table\",\"version\":1,\"courses\":[{\"name\":\"高等数学\",\"location\":\"A302\",\"weekday\":3,\"start\":\"10:10\",\"end\":\"12:00\",\"weeks\":[1,3,5],\"note\":\"带习题册\"},{\"name\":\"待补课\",\"location\":null,\"weekday\":2,\"start\":\"08:00\",\"end\":\"09:00\",\"weeks\":[2],\"note\":\"\"}]}";}
 public static void main(String[] args)throws Exception{
  ImportDraft d=new ImportDraft();d.text(good());d.reference="content://photos/schedule";d.preview=ImportCodec.parse(d.raw,20,new JSONArray());d.preview.valid.get(0).location="B408";d.preview.valid.get(0).note="核对后保留的长备注";
  ImportDraft restored=ImportDraft.read(new JSONObject(d.json().toString()));check(restored.raw.equals(d.raw)&&restored.reference.equals(d.reference),"原文字和对照截图往返");check(restored.preview.valid.get(0).location.equals("B408")&&restored.preview.valid.get(0).note.equals("核对后保留的长备注"),"预览修改重启后保留");check(restored.preview.pending.get(0).isNull("location")&&restored.preview.issues.size()==1,"待核对数据不会猜填");
  restored.text(restored.raw);check(restored.preview!=null,"未改变文字保留预览修改");restored.removePending(0);check(restored.preview.pending.isEmpty()&&restored.preview.issues.isEmpty(),"删除待核对条目同步更新问题列表");restored.removeValid(0);check(restored.preview.valid.isEmpty()&&d.preview.valid.size()==1,"删除草稿条目不会影响原对象");check(ImportDraft.read(restored.json()).preview.valid.isEmpty(),"删除结果被暂存");
  d.text(good()+"\n新文字");check(d.preview==null,"改变粘贴文字后重新校验");d.clear();check(d.raw.isEmpty()&&d.reference.isEmpty()&&d.preview==null,"导入完成后清理本次草稿");
  boolean bad=false;try{ImportDraft.read(new JSONObject().put("valid",new JSONArray()).put("pending",new JSONArray().put(new JSONObject())).put("issues",new JSONArray()));}catch(Exception e){bad=true;}check(bad,"拒绝待核对列表错位");
  SketchModel model=new SketchModel();SketchModel.Stroke pen=new SketchModel.Stroke(0xff148b89,.01f,false);pen.point(.123456f,.765432f);pen.point(.4f,.5f);model.add(pen);SketchModel.Stroke eraser=new SketchModel.Stroke(0xff182534,.03f,true);eraser.point(.4f,.5f);model.add(eraser);
  SketchModel saved=SketchModel.read(new JSONObject(model.json().toString()));check(saved.strokes.size()==2&&saved.strokes.get(0).color==pen.color&&saved.strokes.get(1).eraser,"笔色与橡皮笔画往返");check(Math.abs(saved.strokes.get(0).points.get(0).x-.1235f)<.00001,"保存精度保持");saved.undo();check(saved.strokes.size()==1&&saved.strokes.get(0).color==pen.color,"撤销最近笔画");saved.undo();saved.undo();check(saved.strokes.isEmpty(),"空画布撤销安全");
  pen.point(-2,3);SketchModel.Point edge=pen.points.get(pen.points.size()-1);check(edge.x==0&&edge.y==1,"画笔出界时约束到纸面");
  for(JSONObject invalid:new JSONObject[]{new JSONObject(model.json().toString()).put("version",2),new JSONObject().put("version",1).put("strokes",new JSONArray().put(new JSONObject().put("color",0).put("width",0).put("points",new JSONArray()))),new JSONObject().put("version",1).put("strokes",new JSONArray().put(new JSONObject().put("color",0).put("width",.01).put("points",new JSONArray().put(new JSONArray().put(2).put(.5)))) )}){bad=false;try{SketchModel.read(invalid);}catch(Exception e){bad=true;}check(bad,"拒绝无效涂鸦数据");}
  SketchModel full=new SketchModel();for(int i=0;i<SketchModel.MAX_STROKES;i++){SketchModel.Stroke s=new SketchModel.Stroke(0,.01f,false);s.point(.5f,.5f);full.add(s);}bad=false;try{full.add(pen);}catch(Exception e){bad=true;}check(bad&&full.strokes.size()==SketchModel.MAX_STROKES,"超限不会损坏已有笔画");
  System.out.println("Draft and sketch passed: "+count+" assertions");
 }
}
