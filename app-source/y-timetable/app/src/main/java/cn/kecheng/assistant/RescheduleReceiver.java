package cn.kecheng.assistant;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class RescheduleReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) { Reminders.schedule(context); }
}
