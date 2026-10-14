package cn.kecheng.assistant;
public final class BackgroundGeometryTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}static boolean close(float a,float b){return Math.abs(a-b)<.01f;}
 public static void main(String[] args){
  BackgroundGeometry portrait=new BackgroundGeometry(1000,2000,400,800,1,.5f,.5f);check(close(portrait.width,400)&&close(portrait.height,800)&&close(portrait.left,0)&&close(portrait.top,0),"同长宽比完整铺满");
  BackgroundGeometry wide=new BackgroundGeometry(1600,900,400,800,1,.5f,.5f);check(wide.width>=400&&wide.height>=800&&close(wide.left,(400-wide.width)/2),"横图在竖屏居中覆盖");
  BackgroundGeometry left=new BackgroundGeometry(1600,900,400,800,1,0,.5f),right=new BackgroundGeometry(1600,900,400,800,1,1,.5f);check(close(left.left,0)&&close(right.left+right.width,400),"横向两端均无空白");
  BackgroundGeometry top=new BackgroundGeometry(900,1600,800,400,1,.5f,0),bottom=new BackgroundGeometry(900,1600,800,400,1,.5f,1);check(close(top.top,0)&&close(bottom.top+bottom.height,400),"纵向两端均无空白");
  BackgroundGeometry zoomed=new BackgroundGeometry(1000,2000,400,800,2,.25f,.75f);check(close(zoomed.width,800)&&close(zoomed.left,-100)&&close(zoomed.top,-600),"缩放与位置同时生效");
  BackgroundGeometry same=new BackgroundGeometry(1000,2000,200,400,2,.25f,.75f);check(close(zoomed.left/2,same.left)&&close(zoomed.top/2,same.top),"预览与首页按比例一致");
  check(close(BackgroundGeometry.position(20,400),0)&&close(BackgroundGeometry.position(-999,400),1),"拖动不会露出边缘");
  check(close(BackgroundGeometry.position(-100,400),.25f)&&close(BackgroundGeometry.position(0,0),.5f),"位置还原和无可拖动空间");
  BackgroundGeometry bounded=new BackgroundGeometry(1000,2000,400,800,9,-5,6);check(close(bounded.width,1600)&&close(bounded.left,0)&&close(bounded.top,800-bounded.height),"缩放和位置边界");
  check(close(BackgroundGeometry.clamp(Float.NaN,1,4),1),"无效缩放安全回退");
  BackgroundGeometry fit=new BackgroundGeometry(1600,900,400,800,1,.5f,.5f,true);check(close(fit.width,400)&&close(fit.height,225)&&close(fit.top,(800-225)/2f),"完整显示横图时不裁切");
  BackgroundGeometry fitPortrait=new BackgroundGeometry(900,1600,800,400,1,.5f,.5f,true);check(close(fitPortrait.height,400)&&close(fitPortrait.left,(800-fitPortrait.width)/2),"完整显示竖图时居中");
  System.out.println("Background geometry passed: "+count+" assertions");
 }
}
