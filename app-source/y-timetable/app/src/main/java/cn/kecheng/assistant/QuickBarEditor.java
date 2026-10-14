package cn.kecheng.assistant;
import android.view.*;
import android.widget.*;
import java.util.*;

public final class QuickBarEditor {
 public static void show(MainActivity a){
  List<String> selected=new ArrayList<>(a.store.quickBarItems);ReadingDialog dialog=new ReadingDialog(a,"小栏内容与顺序");dialog.content.addView(Ui.text(a,"勾选要放入小栏的现有内容，用箭头调整顺序。最多同时显示3项，其余左右滑动查看。",13,Ui.MUTED));Ui.gap(dialog.content,14);
  ScrollView scroll=new ScrollView(a);LinearLayout rows=Ui.column(a);scroll.addView(rows);dialog.content.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));Runnable[] redraw=new Runnable[1];
  redraw[0]=()->{rows.removeAllViews();List<String> ordered=new ArrayList<>(selected);for(String id:QuickBarConfig.AVAILABLE)if(!ordered.contains(id))ordered.add(id);
   for(String id:ordered){int index=selected.indexOf(id);LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);row.setBaselineAligned(false);Ui.pad(row,0,8,0,8);CheckBox check=new CheckBox(a);check.setText(QuickBarConfig.label(id));check.setTextColor(Ui.INK);check.setTextSize(16);check.setChecked(index>=0);check.setOnCheckedChangeListener((b,on)->{if(on){if(!selected.contains(id))selected.add(id);}else selected.remove(id);redraw[0].run();});row.addView(check,new LinearLayout.LayoutParams(0,a.dp(48),1));
    Button up=Ui.button(a,"↑",()->{if(index>0){Collections.swap(selected,index,index-1);redraw[0].run();}}),down=Ui.button(a,"↓",()->{if(index>=0&&index<selected.size()-1){Collections.swap(selected,index,index+1);redraw[0].run();}});up.setContentDescription(QuickBarConfig.label(id)+"上移");down.setContentDescription(QuickBarConfig.label(id)+"下移");up.setEnabled(index>0);down.setEnabled(index>=0&&index<selected.size()-1);if(index<0){up.setVisibility(View.INVISIBLE);down.setVisibility(View.INVISIBLE);}row.addView(up,new LinearLayout.LayoutParams(a.dp(44),a.dp(44)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(a.dp(44),a.dp(44));lp.leftMargin=a.dp(6);row.addView(down,lp);rows.addView(row);
   }
  };redraw[0].run();dialog.footer.addView(Ui.button(a,"取消",dialog::dismiss),new LinearLayout.LayoutParams(0,a.dp(44),1));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,a.dp(44),1);lp.leftMargin=a.dp(8);dialog.footer.addView(Ui.button(a,"保存",()->{a.store.setQuickBarItems(selected);if(!a.save())return;dialog.dismiss();a.settings();if(a.store.quickBarEnabled&&a.store.weather&&!a.store.city.isEmpty())a.refreshWeather();}),lp);dialog.show();
 }
}
