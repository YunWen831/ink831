package cn.kecheng.assistant;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.text.*;
import android.content.ClipboardManager;
import android.view.*;
import android.widget.*;
import java.time.LocalDate;
import java.util.*;

public final class ImportFlow {
 final MainActivity a;final ImportDraft draft;ReadingDialog review;TextView referenceLabel;boolean tableMode,expanded;int week;
 ImportFlow(MainActivity a,ImportDraft draft){this.a=a;this.draft=draft;}
 void save(){a.saveDraft();}
 void input(){
  if(!a.store.configured){a.semesterDialog();return;}
  LinearLayout p=a.form();p.addView(a.text("复制指令，把指令和截图发给其他 AI，再粘贴返回的完整文字。草稿和预览中的修改会保留。",14,Ui.MUTED));
  p.addView(Ui.button(a,"复制识别指令",()->a.copy("识别指令",ImportCodec.prompt(a.store.total,a.store.periods.toString()))));p.addView(Ui.button(a,"截图只有第几节？设置时间换算",a::periodDialog));
  EditText input=a.field(p,"粘贴 AI 返回的课表文字",draft.raw,131073);input.setMinLines(5);input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(1_000_000)});
  input.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int count,int after){}public void onTextChanged(CharSequence s,int st,int before,int count){draft.text(s.toString());save();}public void afterTextChanged(Editable e){}});
  LinearLayout actions=new LinearLayout(a);button(actions,"从剪贴板粘贴",()->{ClipboardManager clipboard=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);ClipData data=clipboard.getPrimaryClip();if(data==null||data.getItemCount()==0){a.toast("剪贴板没有文字");return;}CharSequence text=data.getItemAt(0).getText();if(text==null){a.toast("请复制课表文字后再粘贴");return;}input.setText(text);input.setSelection(input.length());});
  button(actions,"清空内容",()->new AlertDialog.Builder(a).setTitle("清空导入内容？").setMessage("仅清空粘贴文字和预览修改，不影响已保存的课表。").setPositiveButton("清空",(d,w)->{draft.preview=null;draft.raw="";input.setText("");save();}).setNegativeButton("取消",null).show());p.addView(actions);Ui.gap(p,10);
  referenceLabel=a.text(draft.reference.isEmpty()?"可选：选择原课表截图，方便核对。":"已保留对照截图",12,Ui.MUTED);p.addView(referenceLabel);LinearLayout images=new LinearLayout(a);button(images,"选择截图",this::pickReference);button(images,"查看截图",this::showReference);p.addView(images);
  AlertDialog dialog=new AlertDialog.Builder(a).setTitle("粘贴课表").setView(a.scroll(p)).setPositiveButton("检查并预览",null).setNegativeButton("暂存并关闭",null).create();dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{try{if(draft.preview==null)draft.preview=ImportCodec.parse(draft.raw,a.store);draft.reconcile(a.store.total,a.store.periods);save();dialog.dismiss();review(draft.preview);}catch(Exception e){a.toast(e.getMessage());}}));dialog.show();
 }
 void refreshTimes(){try{draft.reconcile(a.store.total,a.store.periods);save();if(review!=null&&review.isShowing())refresh();}catch(Exception e){a.toast("导入预览更新失败，草稿仍保留");}}
 void button(LinearLayout row,String title,Runnable click){LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,a.dp(44),1);if(row.getChildCount()>0)lp.leftMargin=a.dp(8);row.addView(Ui.button(a,title,click),lp);}
 void pickReference(){a.startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION),11);}
 void referenceReady(Uri uri){draft.reference=uri.toString();save();if(referenceLabel!=null)referenceLabel.setText("已保留对照截图");if(review!=null&&review.isShowing())refresh();}
 void showReference(){if(draft.reference.isEmpty()){pickReference();return;}PictureViewer.show(a,Uri.parse(draft.reference));}
 void refresh(){save();if(review!=null)review.dismiss();review(draft.preview);}
 void review(ImportCodec.Result r){
  draft.preview=r;save();review=new ReadingDialog(a,"导入预览");LinearLayout body=review.content;
  body.addView(a.text("可导入 "+r.valid.size()+" 条 · 待核对 "+r.issues.size()+" 条",13,Ui.MUTED));Ui.gap(body,10);
  LinearLayout tabs=new LinearLayout(a);button(tabs,tableMode?"条目列表":"✓ 条目列表",()->{tableMode=false;refresh();});button(tabs,tableMode?"✓ 整周表格":"整周表格",()->{tableMode=true;refresh();});button(tabs,"对照截图",this::showReference);body.addView(tabs);Ui.gap(body,12);
  if(tableMode)renderTable(body,r);else renderList(body,r);
  LinearLayout footer=Ui.column(a),saveRow=new LinearLayout(a);Button merge=Ui.button(a,"合并导入",()->merge(r)),replace=Ui.button(a,"替换课表",()->replace(r));merge.setEnabled(!r.valid.isEmpty());replace.setEnabled(!r.valid.isEmpty());saveRow.addView(merge,new LinearLayout.LayoutParams(0,a.dp(44),1));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,a.dp(44),1);lp.leftMargin=a.dp(8);saveRow.addView(replace,lp);footer.addView(saveRow);Ui.gap(footer,6);footer.addView(Ui.button(a,"返回粘贴",()->{review.dismiss();input();}),new LinearLayout.LayoutParams(-1,a.dp(44)));review.footer.addView(footer,new LinearLayout.LayoutParams(-1,-2));review.show();
 }
 void renderList(LinearLayout body,ImportCodec.Result r){
  ScrollView scroll=new ScrollView(a);scroll.setVerticalScrollBarEnabled(false);LinearLayout p=Ui.column(a);scroll.addView(p);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  for(int i=0;i<r.issues.size();i++){int index=i;row(p,"待核对",r.issues.get(i),()->a.pendingEdit(r,index,this::refresh),()->delete(index,true));}
  if(!r.issues.isEmpty()){p.addView(a.text("可直接在这里补充信息；未补充的条目不会导入。",12,0xff9b5e29));Ui.gap(p,10);}
  for(int i=0;i<r.valid.size();i++){Course c=r.valid.get(i);int index=i;row(p,c.name,a.days[c.weekday-1]+" "+ScheduleEngine.time(c.start)+"–"+ScheduleEngine.time(c.end)+" · "+c.location+"\n周次 "+ScheduleEngine.weeksText(c.weeks),()->a.previewEdit(r,index,this::refresh),()->delete(index,false));}
  List<Course> combined=new ArrayList<>(a.store.courses);Set<String> seen=new HashSet<>();for(Course c:combined)seen.add(c.fingerprint());for(Course c:r.valid)if(seen.add(c.fingerprint()))combined.add(c);
  List<String> conflicts=a.store.conflicts(combined);if(!conflicts.isEmpty())p.addView(a.text("冲突预览：\n"+String.join("\n",conflicts.subList(0,Math.min(8,conflicts.size()))),13,0xff9b5e29));
 }
 void row(LinearLayout p,String name,String description,Runnable edit,Runnable remove){
  LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout words=Ui.column(a);Ui.pad(words,6,12,6,12);words.setBackground(Ui.ripple(a,0xfff0f5f1,12));TextView title=a.text(name,16,Ui.INK);words.addView(title);Ui.gap(words,6);TextView sub=a.text(description,12,Ui.MUTED);sub.setMaxLines(4);words.addView(sub);words.setOnClickListener(v->edit.run());row.addView(words,new LinearLayout.LayoutParams(0,-2,1));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(a.dp(54),a.dp(44));lp.leftMargin=a.dp(6);row.addView(Ui.button(a,"删除",remove),lp);p.addView(row,new LinearLayout.LayoutParams(-1,-2));Ui.gap(p,10);
 }
 void delete(int index,boolean pending){new AlertDialog.Builder(a).setTitle("从导入预览中删除？").setMessage("仅删除这次导入的条目，已保存的课程不受影响。").setPositiveButton("删除",(d,w)->{if(pending)draft.removePending(index);else draft.removeValid(index);refresh();}).setNegativeButton("取消",null).show();}
 void renderTable(LinearLayout body,ImportCodec.Result r){
  if(week<1||week>a.store.total){week=1;for(Course c:r.valid)if(!c.weeks.isEmpty()){week=c.weeks.first();break;}}
  LinearLayout controls=new LinearLayout(a);controls.setGravity(Gravity.CENTER_VERTICAL);Spinner weeks=new Spinner(a);String[] labels=new String[a.store.total];for(int i=0;i<labels.length;i++)labels[i]="第 "+(i+1)+" 周";weeks.setAdapter(new ArrayAdapter<>(a,android.R.layout.simple_spinner_dropdown_item,labels));weeks.setSelection(week-1);controls.addView(weeks,new LinearLayout.LayoutParams(0,a.dp(44),1));controls.addView(Ui.button(a,expanded?"适应屏幕":"放大查看",()->{expanded=!expanded;refresh();}),new LinearLayout.LayoutParams(a.dp(94),a.dp(44)));body.addView(controls);
  TextView tip=a.text("只预览本次导入 · 点击课程可修改或删除"+(r.issues.isEmpty()?"":"\n待核对条目请到列表中补充"),12,Ui.MUTED);Ui.pad(tip,0,8,0,10);body.addView(tip);
  ScrollView vertical=new ScrollView(a);vertical.setVerticalScrollBarEnabled(false);body.addView(vertical,new LinearLayout.LayoutParams(-1,0,1));
  Runnable render=()->{vertical.removeAllViews();LocalDate monday=a.store.semester.plusWeeks(week-1);int available=a.getResources().getDisplayMetrics().widthPixels-a.dp(56);WeekTableView table=new WeekTableView(a,r.valid,a.store.calendar(),monday,o->{int index=r.valid.indexOf(o.course);if(index>=0)new AlertDialog.Builder(a).setTitle(o.course.name).setMessage(ScheduleEngine.time(o.start)+"–"+ScheduleEngine.time(o.end)+"\n"+o.location).setPositiveButton("修改",(d,w)->a.previewEdit(r,index,this::refresh)).setNeutralButton("删除",(d,w)->delete(index,false)).setNegativeButton("返回",null).show();},available,expanded);HorizontalScrollView horizontal=new HorizontalScrollView(a);horizontal.addView(table,new HorizontalScrollView.LayoutParams(table.desiredWidth,-2));vertical.addView(horizontal);};render.run();weeks.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> parent,View v,int index,long id){week=index+1;render.run();}public void onNothingSelected(AdapterView<?> p){}});
 }
 void merge(ImportCodec.Result r){List<Course> merged=new ArrayList<>(a.store.courses);Set<String> seen=new HashSet<>();for(Course c:merged)seen.add(c.fingerprint());int added=0;for(Course c:r.valid)if(seen.add(c.fingerprint())){merged.add(c);added++;}int count=added;Runnable accept=()->{a.store.courses.clear();a.store.courses.addAll(merged);if(!a.save())return;complete();a.toast("新增 "+count+" 条，重复安排已跳过");};if(!r.issues.isEmpty())new AlertDialog.Builder(a).setTitle("仅导入已核对条目？").setMessage(r.issues.size()+" 条待核对课程将被跳过。").setPositiveButton("继续",(d,w)->a.confirmConflicts(merged,accept)).setNegativeButton("返回",null).show();else a.confirmConflicts(merged,accept);}
 void replace(ImportCodec.Result r){new AlertDialog.Builder(a).setTitle("替换现有课表？").setMessage("现有课程及单次调整将被删除。待核对条目不会导入。建议先备份。").setPositiveButton("确认替换",(d,w)->a.confirmConflicts(r.valid,()->{a.store.courses.clear();Set<String> seen=new HashSet<>();for(Course c:r.valid)if(seen.add(c.fingerprint()))a.store.courses.add(c);if(!a.save())return;complete();})).setNegativeButton("取消",null).show();}
 void complete(){draft.clear();save();review.dismiss();a.schedule();}
}
