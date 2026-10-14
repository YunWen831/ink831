package cn.kecheng.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import java.time.*;
import java.util.*;

public final class Store {
    final SharedPreferences prefs;
    final Context context;String committedData="{}";
    public final ArrayList<Course> courses=new ArrayList<>();
    public LocalDate semester=LocalDate.now().with(java.time.DayOfWeek.MONDAY);
    public LocalDate opening=semester,holiday=semester.plusWeeks(20);
    public int total=20,reminderMinutes=15,wood=0;
    public float brightness=.18f,panelAlpha=.68f,backgroundZoom=1,backgroundX=.5f,backgroundY=.5f;
    public boolean configured=false,panels=false,notes=true,weather=false,tools=true,reminders=false,sound=false,vibration=true,backgroundFit=false;
    public String city="",weatherText="",background="",preferred="";
    public double latitude=0,longitude=0;
    public long weatherUpdated=0;
    public JSONArray periods=new JSONArray(),wheels=new JSONArray();
    public boolean quickBarEnabled=true;public List<String> quickBarItems=new ArrayList<>(Arrays.asList("sketch","dice","wheel","wood"));
    public Store(Context ctx) {
        context=ctx.getApplicationContext();
        prefs=ctx.getSharedPreferences("course_data",Context.MODE_PRIVATE);
        try { committedData=prefs.getString("data","{}");load(new JSONObject(committedData));committedData=data().toString(); } catch(Exception e) { throw new IllegalStateException("本地课表读取失败，请保留数据并通过备份恢复",e); }
    }
    public JSONObject data() throws JSONException {
        JSONObject j=new JSONObject(); j.put("format","course-assistant-backup").put("version",1).put("semester",semester.toString()).put("total",total).put("configured",configured).put("opening",opening.toString()).put("holiday",holiday.toString());
        JSONArray arr=new JSONArray();for(Course c:courses)arr.put(courseJson(c,true));j.put("courses",arr);
        j.put("brightness",brightness).put("panelAlpha",panelAlpha).put("panels",panels).put("notes",notes).put("weather",weather).put("tools",tools)
            .put("reminders",reminders).put("reminderMinutes",reminderMinutes).put("sound",sound).put("vibration",vibration).put("wood",wood)
            .put("city",city).put("latitude",latitude).put("longitude",longitude).put("weatherText",weatherText).put("weatherUpdated",weatherUpdated)
            .put("background",background).put("backgroundZoom",backgroundZoom).put("backgroundX",backgroundX).put("backgroundY",backgroundY).put("backgroundFit",backgroundFit).put("preferred",preferred).put("periods",periods).put("wheels",wheels).put("quickBarEnabled",quickBarEnabled).put("quickBarItems",new JSONArray(quickBarItems));return j;
    }
    public void load(JSONObject j) throws JSONException {
        Semester dates=readCalendar(j,semester);setCalendar(dates.opening,dates.holiday);configured=j.optBoolean("configured",false);
        ArrayList<Course> parsed=new ArrayList<>();JSONArray arr=j.optJSONArray("courses");if(arr!=null)for(int i=0;i<arr.length();i++)parsed.add(parseCourse(arr.getJSONObject(i),52));courses.clear();courses.addAll(parsed);
        brightness=(float)j.optDouble("brightness",.18);panelAlpha=(float)j.optDouble("panelAlpha",.68);panels=j.optBoolean("panels",false);
        notes=j.optBoolean("notes",true);weather=j.optBoolean("weather",false);tools=j.optBoolean("tools",true);reminders=j.optBoolean("reminders",false);
        reminderMinutes=Math.max(0,Math.min(60,j.optInt("reminderMinutes",15)));sound=j.optBoolean("sound",false);vibration=j.optBoolean("vibration",true);wood=j.optInt("wood",0);
        city=j.optString("city","");latitude=j.optDouble("latitude",0);longitude=j.optDouble("longitude",0);weatherText=j.optString("weatherText","");weatherUpdated=j.optLong("weatherUpdated",0);
        background=j.optString("background","");backgroundZoom=BackgroundGeometry.clamp((float)j.optDouble("backgroundZoom",1),1,4);backgroundX=BackgroundGeometry.clamp((float)j.optDouble("backgroundX",.5),0,1);backgroundY=BackgroundGeometry.clamp((float)j.optDouble("backgroundY",.5),0,1);backgroundFit=j.optBoolean("backgroundFit",false);preferred=j.optString("preferred","");periods=j.optJSONArray("periods");if(periods==null)periods=new JSONArray();wheels=j.optJSONArray("wheels");if(wheels==null)wheels=new JSONArray();
        QuickBarConfig bar=QuickBarConfig.read(j);quickBarEnabled=bar.enabled;setQuickBarItems(bar.items);
    }
    public void setQuickBarItems(List<String> items){quickBarItems=QuickBarConfig.clean(items);weather=quickBarItems.contains("weather");tools=quickBarItems.stream().anyMatch(id->!id.equals("weather"));}
    public boolean save() {try{String candidate=data().toString();boolean ok=SafeSave.attempt(committedData,candidate,value->prefs.edit().putString("data",value).commit(),value->load(new JSONObject(value)));if(ok){committedData=candidate;return true;}}catch(Exception e){try{load(new JSONObject(committedData));}catch(Exception ignored){}}android.widget.Toast.makeText(context,"未保存成功，请检查手机空间；已保留上次保存的内容",android.widget.Toast.LENGTH_LONG).show();return false;}
    public Semester calendar(){return new Semester(opening,holiday);}
    public static Semester readCalendar(JSONObject j,LocalDate fallback)throws JSONException{LocalDate monday=LocalDate.parse(j.optString("semester",fallback.toString()));int count=j.optInt("total",20);if(count<1||count>52||monday.getDayOfWeek()!=DayOfWeek.MONDAY)throw new JSONException("学期设置无效");return new Semester(LocalDate.parse(j.optString("opening",monday.toString())),LocalDate.parse(j.optString("holiday",monday.plusWeeks(count).toString())));}
    public void setCalendar(LocalDate start,LocalDate end){Semester c=new Semester(start,end);opening=c.opening;holiday=c.holiday;semester=c.monday;total=c.weeks;}
    public List<ScheduleEngine.Occurrence> onDate(LocalDate date){return ScheduleEngine.onDate(courses,date,calendar());}
    public List<String> conflicts(List<Course> candidate){return ScheduleEngine.conflicts(candidate,calendar());}
    public static JSONObject courseJson(Course c,boolean internal)throws JSONException {
        JSONObject j=new JSONObject().put("name",c.name).put("location",c.location).put("weekday",c.weekday).put("start",ScheduleEngine.time(c.start)).put("end",ScheduleEngine.time(c.end)).put("weeks",new JSONArray(c.weeks)).put("note",c.note);
        if(internal) {
            j.put("id",c.id);JSONArray arr=new JSONArray();for(Map.Entry<LocalDate,Course.Change> e:c.changes.entrySet()){Course.Change x=e.getValue();arr.put(new JSONObject().put("origin",e.getKey().toString()).put("cancelled",x.cancelled).put("date",x.date==null?e.getKey().toString():x.date.toString()).put("start",ScheduleEngine.time(x.start)).put("end",ScheduleEngine.time(x.end)).put("location",x.location));}j.put("changes",arr);
        }return j;
    }
    public static Course parseCourse(JSONObject j,int total)throws JSONException {
        Course c=new Course();c.id=j.optString("id",c.id);c.name=required(j,"name"); c.location=required(j,"location"); c.note=j.optString("note","");c.weekday=integer(j,"weekday");
        if(c.weekday<1||c.weekday>7)throw new JSONException("星期应为 1–7");
        if(j.isNull("note"))c.note="";if(c.id.isEmpty())throw new JSONException("课程标识无效");
        if(c.name.length()>120||c.location.length()>200||c.note.length()>4000)throw new JSONException("课程文字过长");
        c.start=ScheduleEngine.minutes(required(j,"start"));c.end=ScheduleEngine.minutes(required(j,"end"));if(c.end<=c.start)throw new JSONException("结束时间必须晚于开始时间");
        JSONArray weeks=j.getJSONArray("weeks");for(int n=0;n<weeks.length();n++){Object value=weeks.get(n);if(!(value instanceof Number)||((Number)value).doubleValue()!=((Number)value).intValue())throw new JSONException("周次必须是整数");int w=((Number)value).intValue();if(w<1||w>total)throw new JSONException("周次超出学期范围 1–"+total);c.weeks.add(w);}if(c.weeks.isEmpty())throw new JSONException("缺少上课周次");
        JSONArray changes=j.optJSONArray("changes");if(changes!=null)for(int n=0;n<changes.length();n++){JSONObject a=changes.getJSONObject(n);Course.Change x=new Course.Change();LocalDate origin=LocalDate.parse(a.getString("origin"));x.cancelled=a.optBoolean("cancelled");x.date=LocalDate.parse(a.getString("date"));x.start=ScheduleEngine.minutes(a.getString("start"));x.end=ScheduleEngine.minutes(a.getString("end"));x.location=a.optString("location",c.location);if(!x.cancelled && x.end<=x.start)throw new JSONException("临时课程时间无效");c.changes.put(origin,x);}return c;
    }
    static String required(JSONObject j,String key)throws JSONException { Object v=j.opt(key);if(!(v instanceof String)||((String)v).trim().isEmpty())throw new JSONException("缺少 "+key);return ((String)v).trim(); }
    static int integer(JSONObject j,String key)throws JSONException {Object v=j.opt(key);if(!(v instanceof Number)||((Number)v).doubleValue()!=((Number)v).intValue())throw new JSONException(key+" 必须是整数");return ((Number)v).intValue();}
    public JSONObject exportCourses()throws JSONException {JSONArray a=new JSONArray();for(Course c:courses)a.put(courseJson(c,false));return new JSONObject().put("format","course-table").put("version",1).put("courses",a);}
}
