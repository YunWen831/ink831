package cn.kecheng.assistant;

/** Image placement shared by the home background and its editor. */
public final class BackgroundGeometry {
 public final float width,height,left,top;
 public BackgroundGeometry(float iw,float ih,float vw,float vh,float zoom,float x,float y){
  this(iw,ih,vw,vh,zoom,x,y,false);
 }
 public BackgroundGeometry(float iw,float ih,float vw,float vh,float zoom,float x,float y,boolean fit){
  float scale=(fit?Math.min(vw/iw,vh/ih):Math.max(vw/iw,vh/ih))*clamp(zoom,1,4);
  width=iw*scale;height=ih*scale;
  left=-(width-vw)*clamp(x,0,1);top=-(height-vh)*clamp(y,0,1);
 }
 public static float clamp(float v,float low,float high){return Float.isFinite(v)?Math.max(low,Math.min(high,v)):low;}
 public static float position(float offset,float excess){return excess>.01f?clamp(-offset/excess,0,1):.5f;}
}
