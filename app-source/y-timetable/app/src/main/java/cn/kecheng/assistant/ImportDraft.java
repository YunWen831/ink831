package cn.kecheng.assistant;
import org.json.*;

/** Separate draft data: editing or deleting it never changes the saved timetable. */
public final class ImportDraft {
 public String raw="",reference="";
 public ImportCodec.Result preview;
 public void text(String value){if(!raw.equals(value)){raw=value;preview=null;}}
 public void clear(){raw="";reference="";preview=null;}
 public JSONObject json()throws JSONException{
  JSONObject j=new JSONObject().put("raw",raw).put("reference",reference);
  if(preview!=null){JSONArray valid=new JSONArray(),pending=new JSONArray(),issues=new JSONArray();for(Course c:preview.valid)valid.put(Store.courseJson(c,true));for(JSONObject c:preview.pending)pending.put(c);for(String issue:preview.issues)issues.put(issue);JSONObject sources=new JSONObject();for(java.util.Map.Entry<String,JSONObject> source:preview.lessonSources.entrySet())sources.put(source.getKey(),source.getValue());j.put("valid",valid).put("pending",pending).put("issues",issues).put("lessonSources",sources);}return j;
 }
 public static ImportDraft read(JSONObject j)throws JSONException{
  ImportDraft d=new ImportDraft();d.raw=j.optString("raw","");d.reference=j.optString("reference","");if(d.raw.length()>1_000_000)throw new JSONException("导入草稿过长");
  JSONArray valid=j.optJSONArray("valid");if(valid!=null){d.preview=new ImportCodec.Result();for(int i=0;i<valid.length();i++)d.preview.valid.add(Store.parseCourse(valid.getJSONObject(i),52));JSONArray pending=j.getJSONArray("pending"),issues=j.getJSONArray("issues");if(pending.length()!=issues.length())throw new JSONException("导入草稿不完整");for(int i=0;i<pending.length();i++){d.preview.pending.add(pending.getJSONObject(i));d.preview.issues.add(issues.getString(i));}}
  if(d.preview!=null){JSONObject sources=j.optJSONObject("lessonSources");if(sources!=null)for(Course c:d.preview.valid)if(sources.optJSONObject(c.id)!=null)d.preview.lessonSources.put(c.id,sources.getJSONObject(c.id));}return d;
 }
 public void removeValid(int index){preview.lessonSources.remove(preview.valid.get(index).id);preview.valid.remove(index);}
 public void removePending(int index){preview.pending.remove(index);preview.issues.remove(index);}
 public void reconcile(int total,JSONArray periods)throws Exception{
  if(preview==null)return;
  for(int i=preview.valid.size()-1;i>=0;i--){Course c=preview.valid.get(i);JSONObject source=preview.lessonSources.get(c.id),item=Store.courseJson(c,false);if(source!=null)item.put("start",JSONObject.NULL).put("end",JSONObject.NULL).put("lesson_start",source.getInt("lesson_start")).put("lesson_end",source.getInt("lesson_end"));
   ImportCodec.Result checked=one(item,total,periods);if(checked.valid.isEmpty()){preview.valid.remove(i);preview.lessonSources.remove(c.id);preview.pending.add(item);preview.issues.add(c.name+"："+checked.issues.get(0));}else if(source!=null){Course replacement=checked.valid.get(0);replacement.id=c.id;preview.valid.set(i,replacement);}
  }
  for(int i=preview.pending.size()-1;i>=0;i--){ImportCodec.Result checked=one(preview.pending.get(i),total,periods);if(!checked.valid.isEmpty()){Course c=checked.valid.get(0);preview.valid.add(c);JSONObject source=checked.lessonSources.get(c.id);if(source!=null)preview.lessonSources.put(c.id,source);removePending(i);}else preview.issues.set(i,checked.issues.get(0));}
 }
 static ImportCodec.Result one(JSONObject item,int total,JSONArray periods)throws Exception{return ImportCodec.parse(new JSONObject().put("format","course-table").put("version",1).put("courses",new JSONArray().put(item)).toString(),total,periods);}
}
