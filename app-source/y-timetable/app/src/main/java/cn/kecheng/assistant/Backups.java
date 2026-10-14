package cn.kecheng.assistant;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

public final class Backups {
 static byte[] json(JSONObject j){return j.toString().getBytes(StandardCharsets.UTF_8);}
 static byte[] png(Context c,String uri)throws IOException{Bitmap b=Images.read(c,Uri.parse(uri));try{ByteArrayOutputStream out=new ByteArrayOutputStream();if(!b.compress(Bitmap.CompressFormat.PNG,100,out))throw new IOException("图片无法保存");return out.toByteArray();}finally{b.recycle();}}
 static byte[] drawing(Context c)throws Exception{File file=new File(c.getFilesDir(),"drawing-draft.json");if(!file.isFile())return json(new SketchModel().json());try(InputStream in=new AtomicFile(file).openRead()){JSONObject j=new JSONObject(MainActivity.readBounded(in,4000000));SketchModel.read(j);return json(j);}}
 static BackupArchive.Content content(Context c,JSONObject data)throws Exception{
  JSONObject copy=new JSONObject(data.toString());Map<String,byte[]> assets=new LinkedHashMap<>();List<String> warnings=new ArrayList<>();String background=copy.optString("background","");
  if(!background.isEmpty())try{assets.put("background.png",png(c,background));copy.put("background","");}catch(Exception e){warnings.add("背景图片无法读取，未包含在副本中");copy.put("background","");}
  ImportDraft draft;try{draft=ImportDraft.read(new JSONObject(c.getSharedPreferences("import_draft",Context.MODE_PRIVATE).getString("data","{}")));}catch(Exception e){warnings.add("导入草稿无法读取，未包含在副本中");draft=null;}
  if(draft!=null){if(!draft.reference.isEmpty())try{assets.put("reference.png",png(c,draft.reference));}catch(Exception e){warnings.add("对照截图无法读取，未包含在副本中");}draft.reference="";assets.put("import-draft.json",json(draft.json()));}try{assets.put("drawing-draft.json",drawing(c));}catch(Exception e){warnings.add("涂鸦草稿无法读取，未包含在副本中");}
  return new BackupArchive.Content(copy,assets,warnings,true);
 }
 static void atomic(File target,byte[] bytes)throws IOException{AtomicFile file=new AtomicFile(target);FileOutputStream out=null;try{out=file.startWrite();out.write(bytes);file.finishWrite(out);}catch(Exception e){if(out!=null)file.failWrite(out);throw new IOException("文件未保存成功，请检查手机空间",e);}}
 static void write(File target,BackupArchive.Content content)throws Exception{AtomicFile file=new AtomicFile(target);FileOutputStream out=null;try{out=file.startWrite();BackupArchive.write(out,content);file.finishWrite(out);}catch(Exception e){if(out!=null)file.failWrite(out);throw e;}}
 public static File create(Context c,JSONObject data)throws Exception{File dir=new File(c.getFilesDir(),"backups");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("无法创建副本");File file=new File(dir,"backup-"+System.currentTimeMillis()+"-"+UUID.randomUUID()+".zip");write(file,content(c,data));return file;}
 public static List<File> list(Context c){File[] all=new File(c.getFilesDir(),"backups").listFiles((dir,name)->name.startsWith("backup-")&&(name.endsWith(".json")||name.endsWith(".zip")));List<File> files=new ArrayList<>();if(all!=null)files.addAll(Arrays.asList(all));files.sort(Comparator.comparingLong(File::lastModified).reversed());return files;}
 public static BackupArchive.Content read(File f)throws Exception{try(InputStream in=new FileInputStream(f)){return BackupArchive.read(in);}}
 public static String label(File f){String date=Instant.ofEpochMilli(f.lastModified()).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("M月d日 HH:mm:ss"));try{BackupArchive.Content content=read(f);return date+" · "+content.data.getJSONArray("courses").length()+" 条课程"+(content.portable?" · 完整格式":" · 旧版副本")+(content.warnings.isEmpty()?"":" · 部分内容缺失");}catch(Exception e){return date+" · 无法读取";}}
 public static String savedMessage(File file){try{BackupArchive.Content content=read(file);return content.warnings.isEmpty()?"副本已保存，包含课表、背景和画布":"副本已保存；"+String.join("；",content.warnings);}catch(Exception e){return "副本已保存";}}
 public static void share(Context c,JSONObject data)throws Exception{File file=new File(c.getCacheDir(),"shared-backup.zip");BackupArchive.Content content=content(c,data);write(file,content);if(!content.warnings.isEmpty())android.widget.Toast.makeText(c,String.join("；",content.warnings),1).show();Uri uri=Uri.parse("content://"+c.getPackageName()+".backups/backup.zip");Intent i=new Intent(Intent.ACTION_SEND).setType("application/zip").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);i.setClipData(ClipData.newRawUri("课表备份",uri));c.startActivity(Intent.createChooser(i,"分享备份到其他应用"));}
 static String installImage(Context c,byte[] bytes,List<File> created)throws IOException{BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);if(bounds.outWidth<=0||bounds.outHeight<=0)throw new IOException("备份中的图片无法读取");File dir=new File(c.getFilesDir(),"drawings");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("无法恢复图片");File file=new File(dir,"drawing-"+UUID.randomUUID()+".png");atomic(file,bytes);created.add(file);return "content://"+c.getPackageName()+".drawings/background/"+file.getName();}
 public static void restore(Context c,Store store,BackupArchive.Content bundle)throws Exception{
  BackupArchive.validate(bundle.data);JSONObject prior=store.data(),incoming=new JSONObject(bundle.data.toString());List<File> created=new ArrayList<>();List<FileSwap> swaps=new ArrayList<>();
  try{
   if(bundle.assets.containsKey("background.png"))incoming.put("background",installImage(c,bundle.assets.get("background.png"),created));
   Store check=new Store(c);check.load(incoming);List<RestoreTransaction.Step> steps=new ArrayList<>();
   if(bundle.portable){
    byte[] newDrawing=bundle.assets.get("drawing-draft.json");if(newDrawing!=null){SketchModel.read(new JSONObject(new String(newDrawing,StandardCharsets.UTF_8)));File staged=new File(c.getFilesDir(),"restoring-drawing-"+UUID.randomUUID()+".json");atomic(staged,newDrawing);created.add(staged);FileSwap swap=new FileSwap(new File(c.getFilesDir(),"drawing-draft.json"),staged,new File(c.getFilesDir(),"previous-drawing-"+UUID.randomUUID()+".json"));swaps.add(swap);steps.add(swap);}
    byte[] importBytes=bundle.assets.get("import-draft.json");if(importBytes!=null){ImportDraft draft=ImportDraft.read(new JSONObject(new String(importBytes,StandardCharsets.UTF_8)));if(bundle.assets.containsKey("reference.png"))draft.reference=installImage(c,bundle.assets.get("reference.png"),created);String newImport=draft.json().toString();SharedPreferences prefs=c.getSharedPreferences("import_draft",Context.MODE_PRIVATE);String oldImport=prefs.getString("data","{}");steps.add(new RestoreTransaction.Step(){public void apply()throws Exception{if(!prefs.edit().putString("data",newImport).commit())throw new IOException("导入草稿未恢复成功");}public void rollback()throws Exception{if(!prefs.edit().putString("data",oldImport).commit())throw new IOException("导入草稿回退失败");}});}
   }
   steps.add(new RestoreTransaction.Step(){public void apply()throws Exception{store.load(incoming);if(!store.save())throw new IOException("课表未恢复成功");}public void rollback()throws Exception{store.load(prior);if(!store.save())throw new IOException("课表回退失败");}});
   RestoreTransaction.run(steps);for(FileSwap swap:swaps)swap.finish();
  }catch(Exception e){for(File file:created)file.delete();throw e;}
 }
}
