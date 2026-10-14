package cn.kecheng.assistant;

import java.time.LocalDate;
import java.util.*;

public final class Course {
    public String id = UUID.randomUUID().toString();
    public String name = "", location = "", note = "";
    public int weekday, start, end;
    public final SortedSet<Integer> weeks = new TreeSet<>();
    public final Map<LocalDate, Change> changes = new HashMap<>();
    public static final class Change {
        public boolean cancelled;
        public LocalDate date;
        public int start, end;
        public String location = "";
    }
    public Course copy() {
        Course c = new Course(); c.id=id; c.name=name; c.location=location; c.note=note;
        c.weekday=weekday; c.start=start; c.end=end; c.weeks.addAll(weeks); c.changes.putAll(changes); return c;
    }
    public String fingerprint() { return name.trim()+"|"+location.trim()+"|"+weekday+"|"+start+"|"+end+"|"+weeks; }
}
