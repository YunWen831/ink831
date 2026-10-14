package cn.kecheng.assistant;
import org.json.*;
import java.util.*;

public final class QuickBarConfig {
 public static final List<String> AVAILABLE=Collections.unmodifiableList(Arrays.asList("weather","sketch","dice","wheel","wood"));
 public final boolean enabled;public final List<String> items;
 public QuickBarConfig(boolean enabled,List<String> items){this.enabled=enabled;this.items=clean(items);}
 public static List<String> clean(List<String> values){List<String> result=new ArrayList<>();for(String value:values)if(AVAILABLE.contains(value)&&!result.contains(value))result.add(value);return result;}
 public static QuickBarConfig read(JSONObject j){List<String> items=new ArrayList<>();JSONArray configured=j.optJSONArray("quickBarItems");boolean enabled;
  if(configured!=null){for(int i=0;i<configured.length();i++)items.add(configured.optString(i));enabled=j.optBoolean("quickBarEnabled",true);}else{boolean weather=j.optBoolean("weather",false),tools=j.optBoolean("tools",true);if(weather)items.add("weather");if(tools)items.addAll(Arrays.asList("sketch","dice","wheel","wood"));enabled=weather||tools;}return new QuickBarConfig(enabled,items);
 }
 public static String label(String id){switch(id){case "weather":return "天气";case "sketch":return "涂鸦";case "dice":return "骰子";case "wheel":return "转盘";case "wood":return "木鱼";default:return "";}}
 public JSONObject json()throws JSONException{return new JSONObject().put("quickBarEnabled",enabled).put("quickBarItems",new JSONArray(items));}
}
