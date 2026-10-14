package cn.kecheng.assistant;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

public final class ScheduleEngine {
    public static final class Occurrence {
        public Course course;
        public LocalDate origin, date;
        public int start, end;
        public String location;
        public String key() { return course.id+"@"+origin; }
        public LocalDateTime begins() { return date.atStartOfDay().plusMinutes(start); }
        public LocalDateTime finishes() { return date.atStartOfDay().plusMinutes(end); }
    }
    public static int week(LocalDate day, LocalDate semester) { return (int)Math.floorDiv(ChronoUnit.DAYS.between(semester,day),7)+1; }
    public static boolean applies(Course c, LocalDate day, LocalDate semester, int total) {
        int w=week(day,semester); return w>=1 && w<=total && c.weeks.contains(w) && day.getDayOfWeek().getValue()==c.weekday;
    }
    public static List<Occurrence> onDate(List<Course> courses, LocalDate day, LocalDate semester, int total) {
        List<Occurrence> out=new ArrayList<>();
        for(Course c:courses) {
            if(applies(c,day,semester,total)) {
                Course.Change x=c.changes.get(day);
                if(x==null) out.add(make(c,day,day,c.start,c.end,c.location));
                else if(!x.cancelled && day.equals(x.date)) out.add(make(c,day,x.date,x.start,x.end,x.location));
            }
            for(Map.Entry<LocalDate,Course.Change> e:c.changes.entrySet()) {
                Course.Change x=e.getValue();
                if(!e.getKey().equals(day) && !x.cancelled && day.equals(x.date) && applies(c,e.getKey(),semester,total))
                    out.add(make(c,e.getKey(),day,x.start,x.end,x.location));
            }
        }
        out.sort(Comparator.comparingInt((Occurrence o)->o.start).thenComparing(o->o.course.name).thenComparing(Occurrence::key)); return out;
    }
    public static List<Occurrence> onDate(List<Course> courses,LocalDate day,Semester calendar) {
        if(!calendar.includes(day))return new ArrayList<>();
        List<Occurrence> out=onDate(courses,day,calendar.monday,calendar.weeks);
        out.removeIf(o->!calendar.includes(o.origin));return out;
    }
    private static Occurrence make(Course c,LocalDate origin,LocalDate day,int start,int end,String location) {
        Occurrence o=new Occurrence(); o.course=c;o.origin=origin;o.date=day;o.start=start;o.end=end;o.location=location;return o;
    }
    public static List<Occurrence> current(List<Occurrence> day,LocalTime now) {
        int n=now.getHour()*60+now.getMinute(); List<Occurrence> out=new ArrayList<>();
        for(Occurrence o:day) if(o.start<=n && n<o.end) out.add(o);return out;
    }
    public static List<Occurrence> next(List<Occurrence> day,LocalTime now) {
        int n=now.getHour()*60+now.getMinute(),nearest=Integer.MAX_VALUE; List<Occurrence> out=new ArrayList<>();
        for(Occurrence o:day) if(o.start>n) { if(o.start<nearest){nearest=o.start;out.clear();} if(o.start==nearest)out.add(o); } return out;
    }
    public static boolean overlaps(Occurrence a,Occurrence b) { return a.date.equals(b.date) && a.start<b.end && b.start<a.end; }
    public static List<String> conflicts(List<Course> courses,LocalDate semester,int total) {
        return conflicts(courses,new Semester(semester,semester.plusWeeks(total)));
    }
    public static List<String> conflicts(List<Course> courses,Semester calendar) {
        List<String> out=new ArrayList<>();Set<LocalDate> dates=new TreeSet<>();
        for(int n=0;n<calendar.weeks*7;n++)dates.add(calendar.monday.plusDays(n));
        for(Course c:courses)for(Course.Change x:c.changes.values())if(!x.cancelled && x.date!=null)dates.add(x.date);
        for(LocalDate date:dates) {
            List<Occurrence> day=onDate(courses,date,calendar);
            for(int i=0;i<day.size();i++)for(int j=i+1;j<day.size();j++)if(overlaps(day.get(i),day.get(j))) {
                out.add(date+"："+day.get(i).course.name+" / "+day.get(j).course.name); if(out.size()>=40)return out;
            }
        } return out;
    }
    public static int minutes(String text) {
        if(text==null || !text.matches("(?:[01]\\d|2[0-3]):[0-5]\\d"))throw new IllegalArgumentException("时间格式应为 HH:mm，例如 10:00");
        return Integer.parseInt(text.substring(0,2))*60+Integer.parseInt(text.substring(3));
    }
    public static String time(int n) { return String.format(Locale.ROOT,"%02d:%02d",n/60,n%60); }
    public static SortedSet<Integer> parseWeeks(String text,int total) {
        String s=text.trim().replace('，',',').replace(" ",""); int parity=0;
        if(s.startsWith("单:" )||s.startsWith("单：")){parity=1;s=s.substring(2);} else if(s.startsWith("双:")||s.startsWith("双：")){parity=2;s=s.substring(2);}
        SortedSet<Integer> out=new TreeSet<>();
        try { for(String part:s.split(",")) { String[] range=part.split("-",-1); if(range.length>2)throw new Exception();
            int a=Integer.parseInt(range[0]),b=range.length==2?Integer.parseInt(range[1]):a;
            if(a<1||b<a||b>total)throw new Exception();for(int w=a;w<=b;w++)if(parity==0||(parity==1?w%2==1:w%2==0))out.add(w);
        }}catch(Exception e){throw new IllegalArgumentException("周次填写 1-16、1,3,5 或 单:1-16，范围为 1–"+total);}
        if(out.isEmpty())throw new IllegalArgumentException("至少选择一个上课周次");return out;
    }
    public static String weeksText(Collection<Integer> weeks) {
        StringBuilder out=new StringBuilder();for(Integer w:weeks){if(out.length()>0)out.append(',');out.append(w);}return out.toString();
    }
}
