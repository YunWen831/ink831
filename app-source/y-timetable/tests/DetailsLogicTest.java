package cn.kecheng.assistant;
import java.time.*;
import java.util.*;

public final class DetailsLogicTest {
 static int count;static void check(boolean value,String message){count++;if(!value)throw new AssertionError(message);}
 static Course course(String name,int start,int end){Course c=new Course();c.name=name;c.location="A302";c.weekday=3;c.start=start;c.end=end;c.weeks.addAll(Arrays.asList(1,2));return c;}
 public static void main(String[] args)throws Exception{
  Semester calendar=new Semester(LocalDate.of(2026,10,12),LocalDate.of(2026,10,26));LocalDate day=LocalDate.of(2026,10,14);Course a=course("数学",600,660),b=course("化学",720,780);List<Course> courses=Arrays.asList(a,b);Set<String> sent=new HashSet<>();
  ReminderPlan early=ReminderPlan.next(courses,calendar,day.atTime(9,30),15,sent);check(early.when.equals(day.atTime(9,45))&&!early.catchup&&early.entries.size()==1,"正常提前提醒");
  ReminderPlan late=ReminderPlan.next(courses,calendar,day.atTime(9,50),15,sent);check(late.catchup&&late.when.equals(day.atTime(9,50,1))&&late.entries.get(0).course==a,"启用较晚时补发尚未开始的课程");
  sent.add(ReminderPlan.key(late.entries.get(0)));ReminderPlan next=ReminderPlan.next(courses,calendar,day.atTime(9,51),15,sent);check(next.entries.get(0).course==b&&next.when.equals(day.atTime(11,45)),"已补发的课程不会再次提醒");
  ReminderPlan begun=ReminderPlan.next(courses,calendar,day.atTime(10,0),15,new HashSet<>());check(begun.entries.get(0).course==b,"已开始的课程不补发");
  List<ScheduleEngine.Occurrence> entries=ScheduleEngine.onDate(courses,day,calendar);ScheduleEngine.Occurrence math=entries.get(0);check(ReminderPlan.mayDeliver(math,day.atTime(10,1),15,new HashSet<>()),"系统延迟发送但课程未结束仍可送达");check(!ReminderPlan.mayDeliver(math,day.atTime(11,0),15,new HashSet<>()),"课程结束不发送过期提醒");check(!ReminderPlan.mayDeliver(math,day.atTime(9,44),15,new HashSet<>()),"不会过早发送");check(!ReminderPlan.mayDeliver(math,day.atTime(9,50),15,sent),"接收端也检查重复记录");
  Course simultaneous=course("物理",600,630);ReminderPlan group=ReminderPlan.next(Arrays.asList(a,simultaneous),calendar,day.atTime(9,30),15,new HashSet<>());check(group.entries.size()==2,"同时课程合并提醒");
  check(ReminderPlan.next(courses,calendar,calendar.holiday.atStartOfDay(),15,sent)==null,"学期结束没有提醒");
  Course tomorrow=course("凌晨课",10,30);tomorrow.weekday=4;ReminderPlan midnight=ReminderPlan.next(Arrays.asList(tomorrow),calendar,day.atTime(23,30),30,new HashSet<>());check(midnight.when.equals(day.atTime(23,40)),"明日凌晨课可在今晚提醒");
  Course moved=a.copy();Course.Change change=new Course.Change();change.date=day.plusDays(1);change.start=900;change.end=960;change.location="B408";moved.changes.put(day,change);ReminderPlan changed=ReminderPlan.next(Arrays.asList(moved),calendar,day.atTime(9,0),15,new HashSet<>());check(changed.entries.get(0).date.equals(day.plusDays(1))&&changed.when.equals(day.plusDays(1).atTime(14,45)),"单次调课按新时间提醒");
  String before=HomeState.key(day,ScheduleEngine.current(entries,LocalTime.of(9,30)),ScheduleEngine.next(entries,LocalTime.of(9,30)),"");String anotherMinute=HomeState.key(day,ScheduleEngine.current(entries,LocalTime.of(9,31)),ScheduleEngine.next(entries,LocalTime.of(9,31)),"");check(before.equals(anotherMinute),"普通分钟变化不重建首页");
  String started=HomeState.key(day,ScheduleEngine.current(entries,LocalTime.of(10,0)),ScheduleEngine.next(entries,LocalTime.of(10,0)),"");check(!before.equals(started),"上课边界改变课程区域");check(!started.equals(HomeState.key(day,ScheduleEngine.current(entries,LocalTime.of(10,0)),ScheduleEngine.next(entries,LocalTime.of(10,0)),a.id)),"主显示课程选择也触发更新");
  a.note="新备注";check(!started.equals(HomeState.key(day,ScheduleEngine.current(entries,LocalTime.of(10,0)),ScheduleEngine.next(entries,LocalTime.of(10,0)),"")),"备注变动会更新");
  float alpha=BackgroundContrast.overlay(0,0);check(alpha>.6f&&255*alpha>=179,"深色背景文字区域得到足够浅色衬底");check(BackgroundContrast.overlay(240,0)==0,"明亮图片不增加遮罩");check(BackgroundContrast.overlay(30,.8f)<BackgroundContrast.overlay(30,0),"已有亮度调整计入遮罩");check(BackgroundContrast.shade(0xff000000)==0&&BackgroundContrast.shade(0xffffffff)>=254,"图片亮暗采样正确");
  String[] memory={"candidate"};int[] writes={0};boolean ok=SafeSave.attempt("old","new",value->{writes[0]++;return !value.equals("new");},value->memory[0]=value);check(!ok&&memory[0].equals("old")&&writes[0]==2,"写入失败恢复已保存状态");
  ok=SafeSave.attempt("old","new",value->{throw new java.io.IOException("full");},value->memory[0]=value);check(!ok&&memory[0].equals("old"),"存储异常不继续提交新状态");
  writes[0]=0;ok=SafeSave.attempt("old","new",value->{writes[0]++;return true;},value->{throw new AssertionError("unexpected rollback");});check(ok&&writes[0]==1,"成功保存无需回退");
  List<String> actions=new ArrayList<>();RestoreTransaction.Step first=new RestoreTransaction.Step(){public void apply(){actions.add("apply drawing");}public void rollback(){actions.add("restore drawing");}};RestoreTransaction.Step failure=new RestoreTransaction.Step(){public void apply()throws Exception{actions.add("apply data");throw new java.io.IOException("full");}public void rollback(){actions.add("restore data");}};
  boolean failed=false;try{RestoreTransaction.run(Arrays.asList(first,failure));}catch(Exception e){failed=true;}check(failed&&actions.equals(Arrays.asList("apply drawing","apply data","restore data","restore drawing")),"多文件恢复失败按逆序回退，包括失败步骤");
  actions.clear();RestoreTransaction.run(Arrays.asList(first));check(actions.equals(Arrays.asList("apply drawing")),"恢复成功不回退");
  java.nio.file.Path folder=java.nio.file.Path.of(".cache","file-swap-tests").toAbsolutePath().normalize();java.nio.file.Files.createDirectories(folder);java.nio.file.Path run=java.nio.file.Files.createTempDirectory(folder,"run-");java.io.File target=run.resolve("drawing.json").toFile(),stage=run.resolve("new.json").toFile(),previous=run.resolve("previous.json").toFile();
  java.nio.file.Files.writeString(target.toPath(),"old drawing");java.nio.file.Files.writeString(stage.toPath(),"new drawing");FileSwap swap=new FileSwap(target,stage,previous);swap.apply();check(java.nio.file.Files.readString(target.toPath()).equals("new drawing")&&java.nio.file.Files.readString(previous.toPath()).equals("old drawing"),"应用画布时原文件仍然保留");swap.rollback();check(java.nio.file.Files.readString(target.toPath()).equals("old drawing")&&!previous.exists(),"画布回退通过改名恢复，无需重写原内容");
  java.nio.file.Files.writeString(stage.toPath(),"new drawing");swap=new FileSwap(target,stage,previous);swap.apply();swap.finish();check(target.isFile()&&!previous.exists(),"全部提交成功后才移除旧暂存文件");
  java.nio.file.Files.writeString(stage.toPath(),"failed candidate");swap=new FileSwap(target,stage,previous);failed=false;try{RestoreTransaction.run(Arrays.asList(swap,failure));}catch(Exception e){failed=true;}check(failed&&java.nio.file.Files.readString(target.toPath()).equals("new drawing"),"数据提交失败时原画布文件完整回退");
  java.nio.file.Files.deleteIfExists(target.toPath());java.nio.file.Files.deleteIfExists(stage.toPath());java.nio.file.Files.deleteIfExists(previous.toPath());java.nio.file.Files.delete(run);
  System.out.println("Details logic passed: "+count+" assertions");
 }
}
