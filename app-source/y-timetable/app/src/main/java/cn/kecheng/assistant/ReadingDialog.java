package cn.kecheng.assistant;
import android.app.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;

/** A roomy reading/review window with fixed header and footer. */
public final class ReadingDialog extends Dialog {
 public final LinearLayout content,footer;
 public ReadingDialog(Activity a,String title){
  super(a);requestWindowFeature(Window.FEATURE_NO_TITLE);LinearLayout shell=Ui.column(a);Ui.pad(shell,16,18,16,12);shell.setBackground(Ui.round(0xfff7faf6,22,a));
  TextView header=Ui.text(a,title,20,Ui.INK);header.setTypeface(Typeface.create("sans-serif-medium",0));header.setMaxLines(2);shell.addView(header);Ui.gap(shell,14);
  content=Ui.column(a);shell.addView(content,new LinearLayout.LayoutParams(-1,0,1));Ui.gap(shell,12);footer=new LinearLayout(a);footer.setGravity(Gravity.END);shell.addView(footer,new LinearLayout.LayoutParams(-1,-2));setContentView(shell);
 }
 @Override public void show(){super.show();Window window=getWindow();Activity a=getOwnerActivity();if(a==null&&getContext() instanceof Activity)a=(Activity)getContext();int width=getContext().getResources().getDisplayMetrics().widthPixels,height=getContext().getResources().getDisplayMetrics().heightPixels;window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT));window.setLayout(width-Ui.dp(getContext(),24),(int)(height*.88f));window.setDimAmount(.25f);}
 public void closeButton(){footer.addView(Ui.button(getContext(),"关闭",this::dismiss),new LinearLayout.LayoutParams(-1,Ui.dp(getContext(),44)));}
}
