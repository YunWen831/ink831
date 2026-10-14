package cn.kecheng.assistant;
import android.app.*;import android.content.Context;import android.graphics.Color;import android.view.*;import android.widget.*;import java.time.*;import java.time.format.DateTimeFormatter;import java.util.*;

public final class UiControls {
 public static LinearLayout timeColumn(Context c,String title,TimeField field){LinearLayout box=Ui.column(c);TextView label=Ui.text(c,title,12,Ui.MUTED);label.setGravity(Gravity.CENTER);box.addView(label,new LinearLayout.LayoutParams(-1,Ui.dp(c,24)));box.addView(field,new LinearLayout.LayoutParams(-1,-2));return box;}
 public static final class DateField extends Button {
  LocalDate date;Runnable changed=()->{};
  public DateField(Context c,LocalDate date){super(c);this.date=date;Ui.decorateButton(this);setTextSize(16);refresh();setOnClickListener(v->{DatePickerDialog d=new DatePickerDialog(c,(a,y,m,day)->{this.date=LocalDate.of(y,m+1,day);refresh();changed.run();},this.date.getYear(),this.date.getMonthValue()-1,this.date.getDayOfMonth());d.show();});}
  void refresh(){setText(date.format(DateTimeFormatter.ofPattern("yyyy年M月d日"))+"  ▾");}public LocalDate value(){return date;}public void onChange(Runnable r){changed=r;}
 }
 public static final class TimeField extends Button {
  int minute;public TimeField(Context c,String value){super(c);try{minute=ScheduleEngine.minutes(value);}catch(Exception e){minute=-1;}Ui.decorateButton(this);setTextSize(16);refresh();setOnClickListener(v->{int initial=minute<0?LocalTime.now().getHour()*60+LocalTime.now().getMinute():minute;new TimePickerDialog(c,(picker,h,m)->{minute=h*60+m;refresh();},initial/60,initial%60,true).show();});}
  void refresh(){setText(minute<0?"选择时间  ▾":ScheduleEngine.time(minute)+"  ▾");}public int value(){if(minute<0)throw new IllegalArgumentException("请选择上课和下课时间");return minute;}
 }
 public static final class WeekPicker extends LinearLayout {
  final int total;final SortedSet<Integer> weeks=new TreeSet<>();final LinearLayout modes;final GridLayout custom;final TextView summary;int mode;
  final String[] names={"全周","单周","双周","自定义"};final List<Button> buttons=new ArrayList<>();
  public WeekPicker(Context c,int total,Collection<Integer> initial){super(c);this.total=total;setOrientation(1);if(initial==null)weeks.addAll(set(0));else for(int n:initial)if(n>=1&&n<=total)weeks.add(n);mode=3;for(int i=0;i<3;i++)if(weeks.equals(set(i))){mode=i;break;}
   modes=new LinearLayout(c);modes.setBaselineAligned(false);addView(modes,new LayoutParams(-1,-2));for(int i=0;i<4;i++){int choice=i;Button b=Ui.button(c,names[i],()->choose(choice));b.setMinWidth(0);b.setMinimumWidth(0);b.setTextSize(13);Ui.pad(b,2,8,2,8);LayoutParams lp=new LayoutParams(0,Ui.dp(c,46),1);lp.setMargins(Ui.dp(c,2),0,Ui.dp(c,2),0);modes.addView(b,lp);buttons.add(b);}
   custom=new GridLayout(c);custom.setColumnCount(5);addView(custom,new LayoutParams(-1,-2));summary=Ui.text(c,"",12,Ui.MUTED);Ui.pad(summary,2,10,2,10);addView(summary);render();
  }
  SortedSet<Integer> set(int kind){SortedSet<Integer> s=new TreeSet<>();for(int n=1;n<=total;n++)if(kind==0||(kind==1?n%2==1:n%2==0))s.add(n);return s;}
  void choose(int n){mode=n;if(n<3){weeks.clear();weeks.addAll(set(n));}render();}
  void render(){for(int i=0;i<4;i++){Button b=buttons.get(i);b.setBackground(Ui.round(i==mode?Ui.TEAL:0xffe5edeb,10,getContext()));b.setTextColor(i==mode?Color.WHITE:Ui.INK);}custom.removeAllViews();custom.setVisibility(mode==3?VISIBLE:GONE);if(mode==3)for(int n=1;n<=total;n++){int week=n;CheckBox b=new CheckBox(getContext());b.setText(String.valueOf(n));b.setTextColor(Ui.INK);b.setTextSize(13);b.setMinWidth(0);Ui.pad(b,0,0,0,0);b.setChecked(weeks.contains(n));GridLayout.LayoutParams lp=new GridLayout.LayoutParams();lp.width=0;lp.columnSpec=GridLayout.spec((n-1)%5,1f);lp.rowSpec=GridLayout.spec((n-1)/5);custom.addView(b,lp);b.setOnCheckedChangeListener((button,checked)->{if(checked)weeks.add(week);else weeks.remove(week);updateSummary();});}updateSummary();}
  void updateSummary(){summary.setText(mode==3?"已选 "+weeks.size()+" 周，点击数字勾选":"已选择学期内的"+names[mode]+"，共 "+weeks.size()+" 周");}
  public SortedSet<Integer> selected(){if(weeks.isEmpty())throw new IllegalArgumentException("请至少选择一个上课周次");return new TreeSet<>(weeks);}
 }
}
