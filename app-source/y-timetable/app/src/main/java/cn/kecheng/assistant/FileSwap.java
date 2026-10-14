package cn.kecheng.assistant;
import java.io.*;

/** Restore a staged file while retaining the old file until all data commits succeed. */
public final class FileSwap implements RestoreTransaction.Step {
 final File target,staged,previous;boolean movedOld,installed;
 public FileSwap(File target,File staged,File previous){this.target=target;this.staged=staged;this.previous=previous;}
 public void apply()throws IOException{
  if(previous.exists())throw new IOException("恢复暂存文件已存在");if(!staged.isFile())throw new IOException("恢复资源未准备好");
  if(target.exists()){if(!target.renameTo(previous))throw new IOException("无法保留原画布");movedOld=true;}
  if(!staged.renameTo(target))throw new IOException("无法应用画布");installed=true;
 }
 public void rollback()throws IOException{if(installed&&target.exists()&&!target.delete())throw new IOException("无法回退新画布");if(movedOld&&previous.exists()&&!previous.renameTo(target))throw new IOException("原画布仍保留在恢复暂存文件中");installed=false;movedOld=false;}
 public void finish(){if(movedOld)previous.delete();}
}
