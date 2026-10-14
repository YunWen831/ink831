package cn.kecheng.assistant;
import java.util.*;
public class TableAxisTest {
 static int count;static void check(boolean b,String s){count++;if(!b)throw new AssertionError(s);}static ScheduleEngine.Occurrence o(int a,int b){ScheduleEngine.Occurrence o=new ScheduleEngine.Occurrence();o.start=a;o.end=b;return o;}
 public static void main(String[] args){TableAxis a=new TableAxis(Arrays.asList(o(480,590),o(610,720),o(1120,1230)));check(a.times.equals(Arrays.asList(480,590,610,720,1120,1230)),"保留08:00/09:50/10:10等所有真实边界");for(int n=1;n<a.times.size();n++)check(a.position(a.times.get(n))>a.position(a.times.get(n-1)),"时间行递增");check(a.position(610)-a.position(590)>=52,"相邻精确时间不挤在一起");TableAxis shortCourse=new TableAxis(Arrays.asList(o(610,625)));check(shortCourse.height()>=52,"短课也保留完整时间文字空间");TableAxis same=new TableAxis(Arrays.asList(o(610,720),o(610,720)));check(same.times.size()==2,"共同时间不重复绘制");TableAxis empty=new TableAxis(Collections.emptyList());check(empty.times.get(0)==480&&empty.times.get(empty.times.size()-1)==1080,"空课表默认时间范围");System.out.println("Exact timetable axis passed: "+count+" assertions");}
}
