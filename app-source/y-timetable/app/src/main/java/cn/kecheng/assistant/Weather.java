package cn.kecheng.assistant;
import org.json.*;
import java.net.*;
import java.io.*;

public final class Weather {
 static JSONObject get(String url)throws Exception{HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(10000);connection.setRequestProperty("User-Agent","CourseAssistant/0.1");try{if(connection.getResponseCode()!=200)throw new IOException("天气服务暂不可用");try(InputStream in=connection.getInputStream()){return new JSONObject(MainActivity.readBounded(in,500000));}}finally{connection.disconnect();}}
 public static JSONArray cities(String q)throws Exception{JSONObject j=get("https://geocoding-api.open-meteo.com/v1/search?count=5&language=zh&format=json&name="+URLEncoder.encode(q,"UTF-8"));JSONArray a=j.optJSONArray("results");return a==null?new JSONArray():a;}
 public static String current(double lat,double lon)throws Exception{JSONObject c=get("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,weather_code&timezone=auto").getJSONObject("current");return condition(c.getInt("weather_code"))+" · "+Math.round(c.getDouble("temperature_2m"))+"°C";}
 static String condition(int n){if(n==0)return "晴";if(n<=3)return "多云";if(n==45||n==48)return "雾";if(n>=95)return "雷雨";if(n==71||n==73||n==75||n==77||n==85||n==86)return "雪";if(n>=51&&n<=82)return "雨";return "天气";}
}
