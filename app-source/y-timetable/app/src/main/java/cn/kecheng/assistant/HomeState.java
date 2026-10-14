package cn.kecheng.assistant;
import java.time.LocalDate;
import java.util.List;

public final class HomeState {
 public static String key(LocalDate date,List<ScheduleEngine.Occurrence> current,List<ScheduleEngine.Occurrence> next,String preferred){StringBuilder s=new StringBuilder(date.toString()).append('|').append(preferred);append(s,current);s.append("/next/");append(s,next);return s.toString();}
 static void append(StringBuilder s,List<ScheduleEngine.Occurrence> entries){for(ScheduleEngine.Occurrence o:entries)s.append('|').append(o.key()).append(':').append(o.start).append(':').append(o.end).append(':').append(o.location).append(':').append(o.course.name).append(':').append(o.course.note);}
}
