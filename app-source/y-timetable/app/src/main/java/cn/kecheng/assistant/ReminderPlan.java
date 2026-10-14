package cn.kecheng.assistant;
import java.time.*;
import java.util.*;

public final class ReminderPlan {
 public final LocalDateTime when;public final boolean catchup;public final List<ScheduleEngine.Occurrence> entries;
 ReminderPlan(LocalDateTime when,boolean catchup,List<ScheduleEngine.Occurrence> entries){this.when=when;this.catchup=catchup;this.entries=entries;}
 public static String key(ScheduleEngine.Occurrence o){return o.key()+"|"+o.begins();}
 public static ReminderPlan next(List<Course> courses,Semester calendar,LocalDateTime now,int lead,Set<String> delivered){
  LocalDateTime earliest=null;boolean late=false;List<ScheduleEngine.Occurrence> selected=new ArrayList<>();
  for(int n=0;n<calendar.weeks*7;n++){LocalDate date=calendar.monday.plusDays(n);if(date.isBefore(now.toLocalDate()))continue;for(ScheduleEngine.Occurrence o:ScheduleEngine.onDate(courses,date,calendar)){
   if(!o.begins().isAfter(now)||delivered.contains(key(o)))continue;LocalDateTime original=o.begins().minusMinutes(lead);boolean catchup=!original.isAfter(now);LocalDateTime trigger=catchup?now.plusSeconds(1):original;
   if(earliest==null||trigger.isBefore(earliest)){earliest=trigger;late=catchup;selected.clear();}if(trigger.equals(earliest))selected.add(o);
  }}return earliest==null?null:new ReminderPlan(earliest,late,selected);
 }
 public static boolean mayDeliver(ScheduleEngine.Occurrence o,LocalDateTime now,int lead,Set<String> delivered){return !delivered.contains(key(o))&&!now.isBefore(o.begins().minusMinutes(lead))&&now.isBefore(o.finishes());}
}
