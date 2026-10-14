package cn.kecheng.assistant;

import android.app.*;
import android.graphics.*;
import android.view.*;
import android.widget.*;

public final class BackgroundEditor {
 public interface Apply {boolean save(float zoom,float x,float y,boolean fit);}
 public static void show(Activity a,Bitmap image,float zoom,float x,float y,boolean fit,float brightness,Apply apply){
  LinearLayout body=Ui.column(a);Ui.pad(body,16,12,16,16);
  body.addView(Ui.text(a,"拖动调整位置，双指缩放；保存后应用到首页。",13,Ui.MUTED));Ui.gap(body,12);
  float screenW=a.getResources().getDisplayMetrics().widthPixels,screenH=a.getResources().getDisplayMetrics().heightPixels;
  int width=Math.min((int)screenW-Ui.dp(a,64),(int)((screenH*.58f)*screenW/screenH));
  int height=(int)(width*screenH/screenW);
  Preview view=new Preview(a,image,zoom,x,y,brightness);view.fit=fit;LinearLayout.LayoutParams frame=new LinearLayout.LayoutParams(width,height);frame.gravity=Gravity.CENTER;body.addView(view,frame);Ui.gap(body,10);
  SeekBar slider=new SeekBar(a);slider.setMax(300);slider.setProgress(Math.round((view.zoom-1)*100));body.addView(slider);
  view.changed=()->slider.setProgress(Math.round((view.zoom-1)*100));
  slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int v,boolean user){if(user){view.zoom=1+v/100f;view.invalidate();}}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}});
  Switch mode=new Switch(a);mode.setText("完整显示图片（留空处用浅色填充）");mode.setTextColor(Ui.INK);mode.setTextSize(13);mode.setChecked(fit);Ui.pad(mode,0,8,0,8);mode.setOnCheckedChangeListener((b,v)->{view.fit=v;view.zoom=1;view.x=.5f;view.y=.5f;view.changed.run();view.invalidate();});body.addView(mode);
  body.addView(Ui.button(a,"恢复居中",()->{view.zoom=1;view.x=.5f;view.y=.5f;view.changed.run();view.invalidate();}));
  ScrollView sc=new ScrollView(a);sc.addView(body);
  AlertDialog dialog=new AlertDialog.Builder(a).setTitle("调整背景").setView(sc).setPositiveButton("保存",null).setNegativeButton("取消",null).create();dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{if(apply.save(view.zoom,view.x,view.y,view.fit))dialog.dismiss();}));dialog.show();
 }
 static final class Preview extends Ui.Landscape {
  final ScaleGestureDetector pinch;float downX,downY;Runnable changed=()->{};
  Preview(Activity a,Bitmap bitmap,float zoom,float x,float y,float brightness){
   super(a);image=bitmap;this.zoom=zoom;this.x=x;this.y=y;this.brightness=brightness;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);setContentDescription("背景预览，可拖动与双指缩放，也可使用下方滑块缩放");
   pinch=new ScaleGestureDetector(a,new ScaleGestureDetector.SimpleOnScaleGestureListener(){public boolean onScale(ScaleGestureDetector detector){
    BackgroundGeometry old=geometry();float fx=detector.getFocusX(),fy=detector.getFocusY();float imageX=(fx-old.left)/old.width,imageY=(fy-old.top)/old.height;
    Preview.this.zoom=BackgroundGeometry.clamp(Preview.this.zoom*detector.getScaleFactor(),1,4);BackgroundGeometry next=geometry();
    Preview.this.x=BackgroundGeometry.position(fx-imageX*next.width,next.width-getWidth());Preview.this.y=BackgroundGeometry.position(fy-imageY*next.height,next.height-getHeight());changed.run();invalidate();return true;
   }});
  }
  BackgroundGeometry geometry(){return new BackgroundGeometry(image.getWidth(),image.getHeight(),getWidth(),getHeight(),zoom,x,y,fit);}
  @Override public boolean onTouchEvent(MotionEvent e){
   pinch.onTouchEvent(e);int action=e.getActionMasked();if(action==MotionEvent.ACTION_DOWN)getParent().requestDisallowInterceptTouchEvent(true);
   if(action==MotionEvent.ACTION_MOVE&&!pinch.isInProgress()&&e.getPointerCount()==1){BackgroundGeometry g=geometry();x=BackgroundGeometry.position(g.left+e.getX()-downX,g.width-getWidth());y=BackgroundGeometry.position(g.top+e.getY()-downY,g.height-getHeight());invalidate();}
   if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){getParent().requestDisallowInterceptTouchEvent(false);if(action==MotionEvent.ACTION_UP)performClick();}
   int index=action==MotionEvent.ACTION_POINTER_UP&&e.getActionIndex()==0&&e.getPointerCount()>1?1:0;downX=e.getX(index);downY=e.getY(index);return true;
  }
  @Override public boolean performClick(){super.performClick();return true;}
  @Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth();Paint p=new Paint(3);p.setColor(Ui.INK);p.setTextAlign(Paint.Align.CENTER);p.setTextSize(Ui.dp(getContext(),13));c.drawText("12:30",w/2,Ui.dp(getContext(),32),p);p.setTextAlign(Paint.Align.LEFT);p.setTextSize(Ui.dp(getContext(),12));c.drawText("正在上课",Ui.dp(getContext(),18),getHeight()*.25f,p);p.setTypeface(Typeface.create("sans-serif-medium",0));p.setTextSize(Ui.dp(getContext(),23));c.drawText("课程名称",Ui.dp(getContext(),18),getHeight()*.25f+Ui.dp(getContext(),38),p);p.setTypeface(Typeface.DEFAULT);p.setTextSize(Ui.dp(getContext(),12));c.drawText("下一节课",Ui.dp(getContext(),18),getHeight()*.57f,p);p.setTextSize(Ui.dp(getContext(),18));c.drawText("下一节课程",Ui.dp(getContext(),18),getHeight()*.57f+Ui.dp(getContext(),30),p);}
 }
}
