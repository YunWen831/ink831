package cn.kecheng.assistant;
import android.content.Context;
import android.graphics.*;
import android.view.*;
import java.time.*;
import java.util.*;

public final class WeekTableView extends View {
 public interface Tap {void show(ScheduleEngine.Occurrence o);}
 final Semester calendar;final LocalDate monday;final Tap tap;final Paint p=new Paint(3);
 final java.util.List<java.util.List<WeekLayout.Cell>> days=new ArrayList<>();
 final java.util.List<RectF> hitRects=new ArrayList<>();final java.util.List<ScheduleEngine.Occurrence> hitCourses=new ArrayList<>();
 final TableAxis axis;public final int desiredWidth;public final boolean scrollsHorizontally;
 float downX,downY;final int[] colors={0xffd5e9e6,0xffe7ebd6,0xfff4e2d0,0xffdce6f0,0xffeadfe9};
 public WeekTableView(Context c,Store s,LocalDate monday,Tap tap,int available,boolean expanded){
  this(c,s.courses,s.calendar(),monday,tap,available,expanded);
 }
 public WeekTableView(Context c,java.util.List<Course> courses,Semester calendar,LocalDate monday,Tap tap,int available,boolean expanded){
  super(c);this.calendar=calendar;this.monday=monday;this.tap=tap;setContentDescription("整周课表，每门课程直接显示完整起止时间，点课程查看详情");setFocusable(true);
  java.util.List<ScheduleEngine.Occurrence> all=new ArrayList<>();int maximumLanes=1;
  for(int day=0;day<7;day++){java.util.List<ScheduleEngine.Occurrence> entries=ScheduleEngine.onDate(courses,monday.plusDays(day),calendar);all.addAll(entries);java.util.List<WeekLayout.Cell> cells=WeekLayout.lanes(entries);for(WeekLayout.Cell cell:cells)maximumLanes=Math.max(maximumLanes,cell.lanes);days.add(cells);}
  axis=new TableAxis(all);int readable=(int)d(44+7*Math.max(84,maximumLanes*44+6));desiredWidth=(expanded||maximumLanes>1)?Math.max(available,readable):available;scrollsHorizontally=desiredWidth>available;
 }
 float d(float n){return n*getResources().getDisplayMetrics().density;}
 @Override protected void onMeasure(int ws,int hs){int width=MeasureSpec.getMode(ws)==MeasureSpec.UNSPECIFIED?desiredWidth:MeasureSpec.getSize(ws);setMeasuredDimension(width,(int)d(64+axis.height()+18));}
 @Override protected void onDraw(Canvas c){
  float width=getWidth(),left=d(44),column=(width-left)/7,header=d(64);p.setStyle(Paint.Style.FILL);p.setColor(0xfffbfcfa);c.drawRoundRect(0,0,width,getHeight(),d(16),d(16),p);hitRects.clear();hitCourses.clear();
  p.setTypeface(Typeface.DEFAULT);p.setTextAlign(Paint.Align.CENTER);p.setTextSize(d(11));String[] labels={"一","二","三","四","五","六","日"};
  for(int day=0;day<7;day++){LocalDate date=monday.plusDays(day);float x=left+column*(day+.5f);if(date.equals(LocalDate.now())){p.setColor(0xffe9f3ef);c.drawRect(left+day*column,0,left+(day+1)*column,getHeight(),p);}p.setColor(calendar.includes(date)?Ui.INK:Ui.MUTED);c.drawText("周"+labels[day],x,d(23),p);c.drawText(String.valueOf(date.getDayOfMonth()),x,d(44),p);}
  p.setStrokeWidth(d(.6f));for(int minute:axis.times){float y=header+d(axis.position(minute));p.setColor(0xffe1e8e4);c.drawLine(left,y,width,y,p);p.setColor(Ui.MUTED);p.setTextAlign(Paint.Align.CENTER);p.setTextSize(d(9.5f));c.drawText(ScheduleEngine.time(minute),left/2,y+d(3.5f),p);}p.setColor(0xffe1e8e4);for(int day=0;day<=7;day++)c.drawLine(left+day*column,0,left+day*column,getHeight(),p);
  for(int day=0;day<7;day++)for(WeekLayout.Cell cell:days.get(day)){
   ScheduleEngine.Occurrence o=cell.occurrence;float laneWidth=column/cell.lanes;
   RectF r=new RectF(left+day*column+cell.lane*laneWidth+d(2),header+d(axis.position(o.start))+d(2),left+day*column+(cell.lane+1)*laneWidth-d(2),header+d(axis.position(o.end))-d(2));
   p.setStyle(Paint.Style.FILL);p.setColor(colors[Math.floorMod(o.course.name.hashCode(),colors.length)]);c.drawRoundRect(r,d(7),d(7),p);
   if(cell.lanes>1){p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(d(1));p.setColor(0xffc17d66);c.drawRoundRect(r,d(7),d(7),p);p.setStyle(Paint.Style.FILL);}
   c.save();c.clipRect(r);float inner=r.width()-d(6),center=r.centerX();p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));p.setTextSize(d(10));p.setColor(Ui.TEAL);
   String begin=ScheduleEngine.time(o.start),finish=ScheduleEngine.time(o.end);float top=r.top+d(13);c.drawText(begin,center,top,p);p.setTypeface(Typeface.DEFAULT);c.drawText(finish,center,top+d(13),p);
   p.setTextAlign(Paint.Align.LEFT);p.setColor(Ui.INK);p.setTextSize(d(10.5f));p.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));float y=top+d(30);int lines=Math.min(3,Math.max(1,(int)((r.bottom-y-d(4))/d(13))+1));y=drawText(c,o.course.name,r.left+d(3),y,inner,lines,d(13));
   p.setTypeface(Typeface.DEFAULT);p.setTextSize(d(9));p.setColor(Ui.MUTED);if(y+d(10)<r.bottom)drawText(c,o.location,r.left+d(3),y+d(3),inner,2,d(12));c.restore();hitRects.add(r);hitCourses.add(o);
  }
 }
 float drawText(Canvas c,String s,float x,float y,float width,int max,float line){int offset=0;for(int n=0;n<max&&offset<s.length();n++){int length=p.breakText(s,offset,s.length(),true,Math.max(width,d(8)),null);if(length<1)length=1;String chunk=s.substring(offset,offset+length);if(n==max-1&&offset+length<s.length()){while(chunk.length()>1&&p.measureText(chunk+"…")>width)chunk=chunk.substring(0,chunk.length()-1);chunk+="…";}c.drawText(chunk,x,y,p);offset+=length;y+=line;}return y;}
 @Override public boolean onTouchEvent(MotionEvent e){if(e.getAction()==MotionEvent.ACTION_DOWN){downX=e.getX();downY=e.getY();return true;}if(e.getAction()==MotionEvent.ACTION_UP){if(Math.abs(e.getX()-downX)+Math.abs(e.getY()-downY)<d(12)){performClick();for(int n=0;n<hitRects.size();n++)if(hitRects.get(n).contains(e.getX(),e.getY())){tap.show(hitCourses.get(n));break;}}return true;}return true;}
 @Override public boolean performClick(){super.performClick();return true;}
}
