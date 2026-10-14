package cn.kecheng.assistant;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

public final class Reminders {
 static final String CHANNEL="course_reminders";
 static SharedPreferences state(Context c){return c.getSharedPreferences("reminder_state",Context.MODE_PRIVATE);}
 static PendingIntent pending(Context c,Intent i){return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static NotificationManager manager(Context c){NotificationManager n=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);n.createNotificationChannel(new NotificationChannel(CHANNEL,"上课提醒",NotificationManager.IMPORTANCE_DEFAULT));return n;}
 static boolean notificationsReady(Context c){NotificationManager n=manager(c);NotificationChannel channel=n.getNotificationChannel(CHANNEL);return n.areNotificationsEnabled()&&(Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&(channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE);}
 public static String permissionStatus(Context c){if(!notificationsReady(c))return "应用通知或“上课提醒”通知已关闭";AlarmManager a=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);String permission=Build.VERSION.SDK_INT>=31&&!a.canScheduleExactAlarms()?"普通提醒，可能延后":"准时提醒已允许";String status=state(c).getString("status","");String error=state(c).getString("deliveryError","");String detail=error.isEmpty()?status:error;return permission+(detail.isEmpty()?"":"\n"+detail);}
 static Set<String> delivered(Context c){return new HashSet<>(state(c).getStringSet("delivered",Collections.emptySet()));}
 static void status(Context c,String message){state(c).edit().putString("status",message).apply();}
 public static void retry(Context c){state(c).edit().remove("deliveryError").apply();schedule(c);}
 public static void schedule(Context context){try{
  Store s=new Store(context);AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);Intent intent=new Intent(context,ReminderReceiver.class);alarms.cancel(pending(context,intent));
  if(!s.configured||!s.reminders){status(context,"提醒已关闭");return;}if(!notificationsReady(context)){status(context,"尚未安排：请开启通知");return;}
  ReminderPlan plan=ReminderPlan.next(s.courses,s.calendar(),LocalDateTime.now(),s.reminderMinutes,delivered(context));if(plan==null){status(context,"没有需要提醒的后续课程");return;}
  long when=plan.when.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();ArrayList<String> keys=new ArrayList<>(),dates=new ArrayList<>();for(ScheduleEngine.Occurrence o:plan.entries){keys.add(ReminderPlan.key(o));if(!dates.contains(o.date.toString()))dates.add(o.date.toString());}
  intent.putExtra("when",when).putExtra("catchup",plan.catchup).putStringArrayListExtra("keys",keys).putStringArrayListExtra("dates",dates);PendingIntent alarm=pending(context,intent);boolean exact=Build.VERSION.SDK_INT<31||alarms.canScheduleExactAlarms();
  try{if(exact)alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm);else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm);}catch(SecurityException e){exact=false;alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm);}
  status(context,(plan.catchup?"将补发尚未开始的课程":"下次提醒 "+plan.when.format(DateTimeFormatter.ofPattern("M月d日 HH:mm")))+(exact?"":" · 可能延后"));
 }catch(Exception e){status(context,"提醒安排失败，请点此重新检查权限并重试");}}
 static void deliver(Context c,Intent intent){try{
  Store s=new Store(c);if(!s.reminders)return;if(!notificationsReady(c)){state(c).edit().putString("deliveryError","最近一次提醒未发送：通知已关闭").apply();return;}
  List<String> keys=intent.getStringArrayListExtra("keys"),dates=intent.getStringArrayListExtra("dates");if(keys==null||dates==null)return;
  Set<String> sent=delivered(c);List<String> lines=new ArrayList<>(),accepted=new ArrayList<>();LocalDateTime now=LocalDateTime.now();
  for(String date:dates)for(ScheduleEngine.Occurrence o:s.onDate(LocalDate.parse(date)))if(keys.contains(ReminderPlan.key(o))&&ReminderPlan.mayDeliver(o,now,s.reminderMinutes,sent)){lines.add(o.course.name+" · "+ScheduleEngine.time(o.start)+" · "+o.location);accepted.add(ReminderPlan.key(o));}
  if(lines.isEmpty())return;NotificationManager n=manager(c);PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);String content=String.join("\n",lines);int icon=c.getResources().getIdentifier("notification_icon","drawable",c.getPackageName());
  Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(icon).setContentTitle(intent.getBooleanExtra("catchup",false)?"课程提醒 · 补发":"课程提醒").setContentText(content).setStyle(new Notification.BigTextStyle().bigText(content)).setContentIntent(open).setAutoCancel(true).build();n.notify((int)(intent.getLongExtra("when",0)/1000),notification);
  sent.addAll(accepted);LocalDate cutoff=now.toLocalDate().minusDays(30);sent.removeIf(key->{try{int split=key.lastIndexOf('|');return split>=0&&LocalDateTime.parse(key.substring(split+1)).toLocalDate().isBefore(cutoff);}catch(Exception e){return true;}});
  if(!state(c).edit().putStringSet("delivered",sent).remove("deliveryError").commit())state(c).edit().putString("deliveryError","提醒已发送，但发送记录保存失败").apply();
 }catch(Exception e){state(c).edit().putString("deliveryError","最近一次提醒未能发送，请重新检查权限").apply();}finally{schedule(c);}}
}
