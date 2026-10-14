package cn.kecheng.assistant;
import java.util.*;

/** Every actual start/end is a visible boundary, including non-hour times. */
public final class TableAxis {
 public final List<Integer> times=new ArrayList<>();public final List<Float> offsets=new ArrayList<>();
 public TableAxis(Collection<ScheduleEngine.Occurrence> entries){SortedSet<Integer> points=new TreeSet<>();for(ScheduleEngine.Occurrence o:entries){points.add(o.start);points.add(o.end);}if(points.isEmpty())for(int minute=480;minute<=1080;minute+=60)points.add(minute);times.addAll(points);float y=0;for(int i=0;i<times.size();i++){if(i>0)y+=Math.max(52,(times.get(i)-times.get(i-1))*1.2f);offsets.add(y);}}
 public float height(){return offsets.get(offsets.size()-1);}
 public float position(int minute){int index=Collections.binarySearch(times,minute);if(index>=0)return offsets.get(index);int next=-index-1;if(next==0)return 0;if(next>=times.size())return height();int prev=next-1;return offsets.get(prev)+(minute-times.get(prev))*(offsets.get(next)-offsets.get(prev))/(times.get(next)-times.get(prev));}
}
