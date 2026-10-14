package cn.kecheng.assistant;
import java.time.*;
import java.util.*;

public class ScheduleEngineTest {
    static int assertions;
    static void check(boolean b,String message){assertions++;if(!b)throw new AssertionError(message);}
    static Course c(String name,int weekday,int start,int end,String weeks){Course c=new Course();c.name=name;c.location="A302";c.weekday=weekday;c.start=start;c.end=end;c.weeks.addAll(ScheduleEngine.parseWeeks(weeks,20));return c;}
    public static void main(String[] args){
        LocalDate s=LocalDate.of(2026,10,12),wed=s.plusDays(2);Course a=c("数学",3,600,695,"单:1-16"),b=c("英语",3,840,935,"1-16");List<Course> courses=Arrays.asList(a,b);
        check(ScheduleEngine.week(s.minusDays(1),s)==0,"学期前一日");check(ScheduleEngine.week(s.plusDays(7),s)==2,"周次切换");
        List<ScheduleEngine.Occurrence> day=ScheduleEngine.onDate(courses,wed,s,20);
        check(day.size()==2,"单周课程");check(ScheduleEngine.onDate(courses,wed.plusDays(7),s,20).size()==1,"双周排除");
        check(ScheduleEngine.current(day,LocalTime.of(9,59)).isEmpty(),"开始前");check(ScheduleEngine.current(day,LocalTime.of(10,0)).get(0).course==a,"开始边界");
        check(ScheduleEngine.current(day,LocalTime.of(11,35)).isEmpty(),"结束边界");check(ScheduleEngine.next(day,LocalTime.of(10,0)).get(0).course==b,"当前课不重复作为下一节");
        check(ScheduleEngine.next(day,LocalTime.of(15,35)).isEmpty(),"当天无后续");check(ScheduleEngine.onDate(courses,s.plusWeeks(20),s,20).isEmpty(),"学期外");
        Course endpoint=c("物理",3,695,750,"1-16");check(ScheduleEngine.conflicts(Arrays.asList(a,endpoint),s,20).isEmpty(),"相邻边界不冲突");
        Course overlap=c("物理",3,680,750,"双:1-16");check(ScheduleEngine.conflicts(Arrays.asList(a,overlap),s,20).isEmpty(),"不同周次不冲突");overlap.weeks.add(1);check(!ScheduleEngine.conflicts(Arrays.asList(a,overlap),s,20).isEmpty(),"共同周次冲突");
        Course.Change change=new Course.Change();change.date=wed.plusDays(1);change.start=660;change.end=720;change.location="B205";a.changes.put(wed,change);
        check(ScheduleEngine.onDate(courses,wed,s,20).size()==1,"调课移除原日");check(ScheduleEngine.onDate(courses,wed.plusDays(1),s,20).get(0).location.equals("B205"),"调课新日与地点");
        change.cancelled=true;check(ScheduleEngine.onDate(courses,wed.plusDays(1),s,20).isEmpty(),"单次停课");check(ScheduleEngine.onDate(courses,wed.plusWeeks(2),s,20).size()==2,"其他周保留");
        check(ScheduleEngine.parseWeeks("双:1-6",20).equals(new TreeSet<>(Arrays.asList(2,4,6))),"双周解析");check(ScheduleEngine.minutes("23:59")==1439,"合法时间");
        for(String bad:new String[]{"24:00","9:00","11:60","","aa:bb"}){boolean failed=false;try{ScheduleEngine.minutes(bad);}catch(Exception e){failed=true;}check(failed,"拒绝时间"+bad);}
        for(String bad:new String[]{"0","21","5-2","1-2-3",""}){boolean failed=false;try{ScheduleEngine.parseWeeks(bad,20);}catch(Exception e){failed=true;}check(failed,"拒绝周次"+bad);}
        System.out.println("Schedule engine passed: "+assertions+" assertions");
    }
}
