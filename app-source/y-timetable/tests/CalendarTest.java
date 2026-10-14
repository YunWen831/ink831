package cn.kecheng.assistant;
import java.time.*;import java.util.*;
public final class CalendarTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}
 static Course c(int day,int start,int end){Course c=new Course();c.name="课";c.weekday=day;c.start=start;c.end=end;c.weeks.addAll(Arrays.asList(1,2,3));return c;}
 public static void main(String[] args){
  Semester cal=new Semester(LocalDate.of(2026,9,1),LocalDate.of(2026,9,16));check(cal.monday.equals(LocalDate.of(2026,8,31)),"非周一开学的周次锚点");check(cal.weeks==3,"包含最后不完整周");check(!cal.includes(LocalDate.of(2026,8,31)),"开学日前不上课");check(cal.includes(LocalDate.of(2026,9,1)),"开学当天有效");check(!cal.includes(LocalDate.of(2026,9,16)),"放假当天不上课");
  List<Course> courses=Arrays.asList(c(1,600,660),c(2,600,660),c(3,600,660));check(ScheduleEngine.onDate(courses,LocalDate.of(2026,8,31),cal).isEmpty(),"不显示第一周开学前课");check(ScheduleEngine.onDate(courses,LocalDate.of(2026,9,1),cal).size()==1,"显示开学日课");check(ScheduleEngine.onDate(courses,LocalDate.of(2026,9,16),cal).isEmpty(),"不显示放假日课");
  Course cancelled=c(1,600,660);Course.Change x=new Course.Change();x.date=LocalDate.of(2026,9,2);x.start=600;x.end=660;cancelled.changes.put(LocalDate.of(2026,8,31),x);check(ScheduleEngine.onDate(Arrays.asList(cancelled),x.date,cal).isEmpty(),"开学前不存在的课不能调入");
  List<Course> overlap=Arrays.asList(c(2,600,720),c(2,630,660),c(2,660,690),c(2,720,780));List<WeekLayout.Cell> cells=WeekLayout.lanes(ScheduleEngine.onDate(overlap,LocalDate.of(2026,9,1),cal));check(cells.size()==4,"整周表保留每门课");check(cells.get(0).lanes==2&&cells.get(1).lanes==2,"重叠分栏");check(cells.get(1).lane==cells.get(2).lane,"相邻课程复用分栏");check(cells.get(3).lanes==1,"不重叠课程占满列");
  boolean failed=false;try{new Semester(cal.opening,cal.opening);}catch(Exception e){failed=true;}check(failed,"禁止空学期");System.out.println("Calendar/table layout passed: "+count+" assertions");
 }
}
