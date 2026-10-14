package cn.kecheng.assistant;
import android.app.Activity;
import android.graphics.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;

public final class PictureViewer {
 public static void show(Activity a,Uri uri){try{
  Bitmap bitmap=Images.read(a,uri);ReadingDialog dialog=new ReadingDialog(a,"原课表截图");dialog.content.addView(Ui.text(a,"双指放大，拖动查看细节",12,Ui.MUTED));Ui.gap(dialog.content,8);Picture picture=new Picture(a,bitmap);dialog.content.addView(picture,new LinearLayout.LayoutParams(-1,0,1));dialog.closeButton();dialog.setOnDismissListener(d->bitmap.recycle());dialog.show();
 }catch(Exception e){Toast.makeText(a,"截图无法读取，请重新选择",Toast.LENGTH_LONG).show();}}
 static final class Picture extends View {
  final Bitmap bitmap;final Paint p=new Paint(3);final ScaleGestureDetector detector;float zoom=1,left,top,lastX,lastY;boolean initialized;
  Picture(Activity a,Bitmap b){super(a);bitmap=b;setContentDescription("原课表截图");detector=new ScaleGestureDetector(a,new ScaleGestureDetector.SimpleOnScaleGestureListener(){public boolean onScale(ScaleGestureDetector d){float old=zoom;zoom=BackgroundGeometry.clamp(zoom*d.getScaleFactor(),1,8);left=d.getFocusX()-(d.getFocusX()-left)*zoom/old;top=d.getFocusY()-(d.getFocusY()-top)*zoom/old;clamp();invalidate();return true;}});}
  float scale(){return Math.min(getWidth()/(float)bitmap.getWidth(),getHeight()/(float)bitmap.getHeight())*zoom;}
  void clamp(){float w=bitmap.getWidth()*scale(),h=bitmap.getHeight()*scale();left=w<=getWidth()?(getWidth()-w)/2:Math.max(getWidth()-w,Math.min(0,left));top=h<=getHeight()?(getHeight()-h)/2:Math.max(getHeight()-h,Math.min(0,top));}
  protected void onDraw(Canvas c){if(!initialized){clamp();initialized=true;}c.drawColor(Color.WHITE);float s=scale();c.drawBitmap(bitmap,null,new RectF(left,top,left+bitmap.getWidth()*s,top+bitmap.getHeight()*s),p);}
  public boolean onTouchEvent(MotionEvent e){detector.onTouchEvent(e);if(e.getActionMasked()==MotionEvent.ACTION_MOVE&&!detector.isInProgress()&&e.getPointerCount()==1){left+=e.getX()-lastX;top+=e.getY()-lastY;clamp();invalidate();}int index=e.getActionMasked()==MotionEvent.ACTION_POINTER_UP&&e.getActionIndex()==0&&e.getPointerCount()>1?1:0;lastX=e.getX(index);lastY=e.getY(index);if(e.getActionMasked()==MotionEvent.ACTION_UP)performClick();return true;}
  public boolean performClick(){super.performClick();return true;}
 }
}
