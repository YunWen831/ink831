package cn.kecheng.assistant;
import java.util.*;

public final class RestoreTransaction {
 public interface Step {void apply()throws Exception;void rollback()throws Exception;}
 public static void run(List<Step> steps)throws Exception{
  List<Step> attempted=new ArrayList<>();try{for(Step step:steps){attempted.add(step);step.apply();}}catch(Exception failure){for(int i=attempted.size()-1;i>=0;i--)try{attempted.get(i).rollback();}catch(Exception rollback){failure.addSuppressed(rollback);}throw failure;}
 }
}
