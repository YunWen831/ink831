package cn.kecheng.assistant;
import java.util.*;

/** Assign overlapping occurrences separate lanes without hiding any course. */
public final class WeekLayout {
 public static final class Cell {public ScheduleEngine.Occurrence occurrence;public int lane,lanes;}
 public static List<Cell> lanes(List<ScheduleEngine.Occurrence> input){
  List<ScheduleEngine.Occurrence> sorted=new ArrayList<>(input);sorted.sort(Comparator.comparingInt(o->o.start));List<Cell> out=new ArrayList<>();
  for(int i=0;i<sorted.size();){int end=sorted.get(i).end,j=i+1;while(j<sorted.size()&&sorted.get(j).start<end){end=Math.max(end,sorted.get(j).end);j++;}
   List<Integer> ends=new ArrayList<>();List<Cell> group=new ArrayList<>();
   for(int k=i;k<j;k++){ScheduleEngine.Occurrence o=sorted.get(k);int lane=0;while(lane<ends.size()&&ends.get(lane)>o.start)lane++;if(lane==ends.size())ends.add(o.end);else ends.set(lane,o.end);Cell c=new Cell();c.occurrence=o;c.lane=lane;group.add(c);}
   for(Cell c:group){c.lanes=ends.size();out.add(c);}i=j;
  }return out;
 }
}
