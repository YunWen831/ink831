package cn.kecheng.assistant;

public final class SafeSave {
 public interface Write {boolean write(String data)throws Exception;}
 public interface Restore {void restore(String data)throws Exception;}
 public static boolean attempt(String previous,String candidate,Write writer,Restore restore){
  try{if(writer.write(candidate))return true;}catch(Exception ignored){}
  try{writer.write(previous);}catch(Exception ignored){}
  try{restore.restore(previous);}catch(Exception e){throw new IllegalStateException("无法恢复上次保存的内容",e);}return false;
 }
}
