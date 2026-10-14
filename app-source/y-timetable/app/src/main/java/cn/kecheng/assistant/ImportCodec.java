package cn.kecheng.assistant;
import org.json.*;
import java.util.*;

public final class ImportCodec {
    public static final class Result { public final List<Course> valid=new ArrayList<>();public final List<String> issues=new ArrayList<>();public final List<JSONObject> pending=new ArrayList<>();public final Map<String,JSONObject> lessonSources=new HashMap<>(); }
    public static Result parse(String raw,Store store)throws Exception { return parse(raw,store.total,store.periods); }
    public static Result parse(String raw,int total,JSONArray periods)throws Exception {
        if(raw.length()>1_000_000)throw new Exception("文字过长，请分批导入");
        List<String> candidates=objects(raw);JSONObject root=null;
        for(String candidate:candidates)try {JSONObject j=new JSONObject(candidate);if(j.has("courses")){if(root!=null)throw new IllegalStateException("检测到多份课表，请只粘贴一份");root=j;}}catch(JSONException ignored){}
        if(root==null)throw new Exception("没有找到完整的课表数据，请复制 AI 返回的完整内容");
        if(!"course-table".equals(root.optString("format")))throw new Exception("格式应为 course-table，请使用本软件的识别指令");
        if(Store.integer(root,"version")!=1)throw new Exception("不支持此格式版本，请使用 version: 1");
        JSONArray arr=root.getJSONArray("courses");if(arr.length()>1000)throw new Exception("课程数量过多，请分批导入");Result result=new Result();
        for(int i=0;i<arr.length();i++) { JSONObject j=arr.optJSONObject(i);String label="第 "+(i+1)+" 条"+(j==null?"":"（"+j.optString("name","未命名")+"）");
            try {if(j==null)throw new Exception("课程必须是对象");JSONObject item=new JSONObject(j.toString()); item.remove("id");item.remove("changes");
                if(item.optJSONArray("uncertain")!=null && item.getJSONArray("uncertain").length()>0)throw new Exception("AI 标记不确定："+item.getJSONArray("uncertain"));
                boolean byLesson=!item.has("start")||item.isNull("start")||!item.has("end")||item.isNull("end");if(byLesson){
                    int a=Store.integer(item,"lesson_start"),b=Store.integer(item,"lesson_end");if(a<1||b<a||b>periods.length())throw new Exception("缺少第 "+a+"–"+b+" 节的作息时间，请先设置");
                    item.put("start",periods.getJSONObject(a-1).getString("start"));item.put("end",periods.getJSONObject(b-1).getString("end"));
                }Course c=Store.parseCourse(item,total);result.valid.add(c);if(byLesson)result.lessonSources.put(c.id,new JSONObject().put("lesson_start",item.getInt("lesson_start")).put("lesson_end",item.getInt("lesson_end")));
            }catch(Exception e){ result.issues.add(label+"："+e.getMessage());result.pending.add(j==null?new JSONObject():new JSONObject(j.toString())); }
        }if(arr.length()==0)throw new Exception("课表没有课程");return result;
    }
    static List<String> objects(String raw) {
        List<String> result=new ArrayList<>();boolean quoted=false,escape=false;int depth=0,start=-1;
        for(int i=0;i<raw.length();i++){char c=raw.charAt(i);if(quoted){if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='"')quoted=false;continue;}if(c=='"' && depth>0){quoted=true;continue;}if(c=='{'){if(depth++==0)start=i;}else if(c=='}'&&depth>0){if(--depth==0)result.add(raw.substring(start,i+1));}}return result;
    }
    public static String prompt(int weeks,String periods) {
        return "请识别我提供的课表截图，输出一个完整 JSON 对象，不要解释。格式：{\"format\":\"course-table\",\"version\":1,\"courses\":[{\"name\":\"课程名称\",\"location\":\"教室\",\"weekday\":3,\"start\":\"10:00\",\"end\":\"11:35\",\"weeks\":[1,3,5],\"note\":\"\"}]}。weekday为1至7，周一为1；时间为24小时HH:mm；weeks明确列出实际上课周次（1至"+weeks+"），结合单双周和截图标注处理。同一门课不同星期或时段分开记录。不要猜学期开始日期。不要根据示例周次推测截图；截图未给周次、地点或时间且无法确定时，将该字段设为null，并在该课程添加uncertain数组说明问题。截图只有第几节时，可填写lesson_start和lesson_end整数，start/end为null，由软件换算；作息参考："+periods+"。不要省略不确定的课程，不要编造信息。";
    }
}
