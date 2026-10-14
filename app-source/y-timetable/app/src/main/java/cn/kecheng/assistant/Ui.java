package cn.kecheng.assistant;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.text.Layout;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.*;
import android.widget.*;
public final class Ui {
 public static final int INK=0xff182534,MUTED=0xff5b6e7d,TEAL=0xff148b89;
 public static int dp(Context c,float v){return (int)(v*c.getResources().getDisplayMetrics().density+.5f);}
 public static LinearLayout column(Context c){LinearLayout v=new LinearLayout(c);v.setOrientation(1);return v;}
 public static TextView text(Context c,String s,float size,int color){TextView v=new TextView(c);v.setText(s);v.setTextSize(size);v.setTextColor(color);v.setFontFeatureSettings("tnum");v.setIncludeFontPadding(false);return v;}
 public static void pad(View v,int l,int t,int r,int b){v.setPadding(dp(v.getContext(),l),dp(v.getContext(),t),dp(v.getContext(),r),dp(v.getContext(),b));}
 public static GradientDrawable round(int color,int radius,Context c){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(c,radius));return g;}
 public static RippleDrawable ripple(Context c,int color,int radius){return new RippleDrawable(ColorStateList.valueOf(0x24148b89),round(color,radius,c),round(Color.WHITE,radius,c));}
 public static void decorateButton(Button b){Context c=b.getContext();b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(dp(c,44));b.setMinimumHeight(dp(c,44));b.setIncludeFontPadding(false);b.setTextColor(TEAL);b.setGravity(Gravity.CENTER);b.setStateListAnimator(null);b.setElevation(0);b.setBackgroundTintList(null);b.setBackground(ripple(c,0xffe7f0ed,12));pad(b,10,8,10,8);}
 public static Button button(Context c,String s,Runnable action){Button b=new Button(c);decorateButton(b);b.setText(s);b.setTextSize(14);b.setOnClickListener(v->action.run());return b;}
 public static TextView centered(Context c,String s,float size,int color){TextView t=text(c,s,size,color);t.setGravity(Gravity.CENTER);return t;}
 public static class CourseTitle extends TextView {
  final float maximum,minimum;public CourseTitle(Context c,String s,float max,float min){super(c);maximum=max;minimum=min;setText(s);setTextColor(INK);setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));setIncludeFontPadding(false);setMaxLines(2);setEllipsize(TextUtils.TruncateAt.END);setBreakStrategy(Layout.BREAK_STRATEGY_BALANCED);setTextSize(max);}
  @Override protected void onMeasure(int ws,int hs){float width=MeasureSpec.getSize(ws)-getPaddingLeft()-getPaddingRight();if(width>0){Paint measure=new Paint(getPaint());float scale=getResources().getDisplayMetrics().scaledDensity;measure.setTextSize(maximum*scale);float needed=measure.measureText(getText().toString());float size=Math.max(minimum,Math.min(maximum,needed>0?(width/needed)*maximum:maximum));if(Math.abs(getTextSize()-size*scale)>.1f)setTextSize(TypedValue.COMPLEX_UNIT_SP,size);}super.onMeasure(ws,hs);}
 }
 public static void gap(LinearLayout p,int h){p.addView(new View(p.getContext()),new LinearLayout.LayoutParams(1,dp(p.getContext(),h)));}
 public static class Icon extends View {
  final String kind;final Paint p=new Paint(3);
  public Icon(Context c,String k,Runnable click){super(c);kind=k;setContentDescription(k.equals("calendar")?"查看课表":k.equals("gear")?"打开设置":"返回");setOnClickListener(v->click.run());setFocusable(true);}
  protected void onDraw(Canvas c){super.onDraw(c);float density=getResources().getDisplayMetrics().density;c.save();c.translate(getWidth()/2f,getHeight()/2f);c.scale(density,density);p.setColor(INK);p.setStrokeWidth(1.65f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
   if(kind.equals("calendar")){c.drawRoundRect(-9,-8,9,10,2,2,p);c.drawLine(-9,-3,9,-3,p);c.drawLine(-4,-10,-4,-6,p);c.drawLine(4,-10,4,-6,p);c.drawLine(-4,2,-2,2,p);c.drawLine(2,2,4,2,p);}else if(kind.equals("gear")){Path path=new Path();for(int i=0;i<32;i++){double a=i*Math.PI/16;float r=(i%4==0||i%4==3)?10.5f:8.5f;float x=(float)Math.cos(a)*r,y=(float)Math.sin(a)*r;if(i==0)path.moveTo(x,y);else path.lineTo(x,y);}path.close();c.drawPath(path,p);c.drawCircle(0,0,3.5f,p);}else{c.drawLine(4,-8,-4,0,p);c.drawLine(-4,0,4,8,p);}c.restore();}
 }
 public static class Landscape extends View {
  final Paint p=new Paint(3);public float brightness=.18f,zoom=1,x=.5f,y=.5f;public boolean fit;public Bitmap image;public Landscape(Context c){super(c);setImportantForAccessibility(2);}
  protected void onDraw(Canvas c){float w=getWidth(),h=getHeight();if(image!=null){c.drawColor(0xffe8efea);BackgroundGeometry g=new BackgroundGeometry(image.getWidth(),image.getHeight(),w,h,zoom,x,y,fit);p.setShader(null);p.setColor(-1);c.drawBitmap(image,null,new RectF(g.left,g.top,g.left+g.width,g.top+g.height),p);}else{p.setShader(new LinearGradient(0,0,0,h,new int[]{0xffc1def0,0xfff4eddf,0xffd9e4de},null,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);mountain(c,w,h,.72f,0xffc6d5da,0);mountain(c,w,h,.81f,0xffb1c7cc,1);mountain(c,w,h,.9f,0xff91b1af,2);}p.setColor(Color.argb((int)(Math.max(0,Math.min(1,brightness))*220),255,255,255));c.drawRect(0,0,w,h,p);if(image!=null&&w>0&&h>0){float a=shade(w,h,0,.18f),b=shade(w,h,.18f,.64f),d=shade(w,h,.64f,1);int[] colors={veil(a),veil(a),veil(b),veil(b),veil((b+d)/2),veil(d),veil(d)};p.setShader(new LinearGradient(0,0,0,h,colors,new float[]{0,.15f,.2f,.61f,.68f,.75f,1},Shader.TileMode.CLAMP));p.setColor(Color.WHITE);c.drawRect(0,0,w,h,p);p.setShader(null);}}
  int veil(float alpha){return Color.argb(Math.round(alpha*255),255,255,255);}
  float shade(float w,float h,float begin,float end){BackgroundGeometry g=new BackgroundGeometry(image.getWidth(),image.getHeight(),w,h,zoom,x,y,fit);int darkest=255;for(int row=0;row<6;row++)for(int col=0;col<10;col++){float sx=w*(col+.5f)/10,sy=h*(begin+(end-begin)*(row+.5f)/6);int ix=(int)((sx-g.left)*image.getWidth()/g.width),iy=(int)((sy-g.top)*image.getHeight()/g.height);int color=ix>=0&&ix<image.getWidth()&&iy>=0&&iy<image.getHeight()?image.getPixel(ix,iy):0xffe8efea;darkest=Math.min(darkest,BackgroundContrast.shade(color));}return BackgroundContrast.overlay(darkest,brightness);}
  void mountain(Canvas c,float w,float h,float base,int color,int seed){Path a=new Path();a.moveTo(0,h);a.lineTo(0,h*base);for(int i=0;i<=16;i++)a.lineTo(w*i/16f,h*(base+(float)(Math.sin(i*.9+seed)*.035+Math.cos(i*1.9+seed)*.018)));a.lineTo(w,h);a.close();p.setColor(color);c.drawPath(a,p);}
 }
}
