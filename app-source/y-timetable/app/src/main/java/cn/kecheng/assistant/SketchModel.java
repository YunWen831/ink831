package cn.kecheng.assistant;
import org.json.*;
import java.util.*;

public final class SketchModel {
 public static final int MAX_STROKES=1000,MAX_POINTS=100000;
 public static final class Point {public final float x,y;public Point(float x,float y){this.x=x;this.y=y;}}
 public static final class Stroke {
  public final int color;public final float width;public final boolean eraser;public final List<Point> points=new ArrayList<>();
  public Stroke(int color,float width,boolean eraser){this.color=color;this.width=width;this.eraser=eraser;}
  public void point(float x,float y){if(points.size()<5000)points.add(new Point(Math.round(BackgroundGeometry.clamp(x,0,1)*10000)/10000f,Math.round(BackgroundGeometry.clamp(y,0,1)*10000)/10000f));}
 }
 public final List<Stroke> strokes=new ArrayList<>();
 public void add(Stroke stroke){if(stroke.points.isEmpty())return;int count=stroke.points.size();for(Stroke s:strokes)count+=s.points.size();if(strokes.size()>=MAX_STROKES||count>MAX_POINTS)throw new IllegalStateException("画布内容较多，请先保存图片，再清空继续画");strokes.add(stroke);}
 public void undo(){if(!strokes.isEmpty())strokes.remove(strokes.size()-1);}
 public JSONObject json()throws JSONException{
  JSONArray arr=new JSONArray();for(Stroke s:strokes){JSONArray points=new JSONArray();for(Point p:s.points)points.put(new JSONArray().put(p.x).put(p.y));arr.put(new JSONObject().put("color",s.color).put("width",s.width).put("eraser",s.eraser).put("points",points));}
  return new JSONObject().put("version",1).put("strokes",arr);
 }
 public static SketchModel read(JSONObject j)throws JSONException{
  if(j.optInt("version")!=1)throw new JSONException("不支持的涂鸦格式");SketchModel model=new SketchModel();JSONArray strokes=j.getJSONArray("strokes");
  for(int i=0;i<strokes.length();i++){JSONObject item=strokes.getJSONObject(i);float width=(float)item.getDouble("width");if(!Float.isFinite(width)||width<.001f||width>.1f)throw new JSONException("画笔粗细无效");Stroke stroke=new Stroke(item.getInt("color"),width,item.optBoolean("eraser"));JSONArray points=item.getJSONArray("points");if(points.length()>5000)throw new JSONException("笔画过长");for(int n=0;n<points.length();n++){JSONArray pair=points.getJSONArray(n);float x=(float)pair.getDouble(0),y=(float)pair.getDouble(1);if(!Float.isFinite(x)||!Float.isFinite(y)||x<0||x>1||y<0||y>1)throw new JSONException("笔画位置无效");stroke.point(x,y);}model.add(stroke);}return model;
 }
}
