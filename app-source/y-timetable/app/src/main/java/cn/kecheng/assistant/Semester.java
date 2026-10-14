package cn.kecheng.assistant;
import java.time.*;
import java.time.temporal.ChronoUnit;

/** School opens on opening; the first vacation day is excluded. */
public final class Semester {
 public final LocalDate opening,holiday,monday;public final int weeks;
 public Semester(LocalDate opening,LocalDate holiday){
  if(opening==null||holiday==null||!holiday.isAfter(opening))throw new IllegalArgumentException("放假日必须晚于开学日");
  this.opening=opening;this.holiday=holiday;this.monday=opening.with(DayOfWeek.MONDAY);
  long days=ChronoUnit.DAYS.between(monday,holiday);weeks=(int)((days+6)/7);
  if(weeks<1||weeks>52)throw new IllegalArgumentException("学期长度应在 1 至 52 个教学周以内");
 }
 public boolean includes(LocalDate day){return !day.isBefore(opening)&&day.isBefore(holiday);}
}
