package cn.kecheng.assistant;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.zip.*;

/** Portable backups use a small allow-list and never extract archive paths. */
public final class BackupArchive {
 public static final int MAX_TOTAL=64*1024*1024;
 static final Set<String> ALLOWED=new HashSet<>(Arrays.asList("background.png","reference.png","drawing-draft.json","import-draft.json"));
 public static final class Content {
  public final JSONObject data;public final Map<String,byte[]> assets;public final List<String> warnings;public final boolean portable;
  public Content(JSONObject data,Map<String,byte[]> assets,List<String> warnings,boolean portable){this.data=data;this.assets=assets;this.warnings=warnings;this.portable=portable;}
 }
 public static void validate(JSONObject j)throws Exception{
  if(!"course-assistant-backup".equals(j.optString("format"))||Store.integer(j,"version")!=1)throw new IOException("不是有效的Y课表备份");
  Semester calendar=Store.readCalendar(j,LocalDate.now().with(java.time.DayOfWeek.MONDAY));JSONArray courses=j.getJSONArray("courses");if(courses.length()>1000)throw new IOException("备份课程过多");for(int n=0;n<courses.length();n++)Store.parseCourse(courses.getJSONObject(n),52);
 }
 static int limit(String name){return name.endsWith(".png")?24*1024*1024:4*1024*1024;}
 public static void write(OutputStream output,Content c)throws Exception{
  validate(c.data);JSONArray names=new JSONArray();int total=0;for(Map.Entry<String,byte[]> asset:c.assets.entrySet()){if(!ALLOWED.contains(asset.getKey())||asset.getValue().length>limit(asset.getKey()))throw new IOException("备份资源不符合格式");names.put(asset.getKey());total+=asset.getValue().length;}if(total>MAX_TOTAL)throw new IOException("备份资源过大");
  JSONObject manifest=new JSONObject().put("format","course-assistant-backup").put("version",2).put("data",c.data).put("assets",names).put("warnings",new JSONArray(c.warnings));byte[] description=manifest.toString().getBytes(StandardCharsets.UTF_8);if(description.length>limit("manifest.json"))throw new IOException("备份课表过大");
  try(ZipOutputStream zip=new ZipOutputStream(new FilterOutputStream(output){public void close()throws IOException{flush();}})){zip.putNextEntry(new ZipEntry("manifest.json"));zip.write(description);zip.closeEntry();for(Map.Entry<String,byte[]> asset:c.assets.entrySet()){zip.putNextEntry(new ZipEntry(asset.getKey()));zip.write(asset.getValue());zip.closeEntry();}zip.finish();zip.flush();}
 }
 static byte[] bounded(InputStream input,int limit)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=input.read(b))!=-1){if(out.size()+n>limit)throw new IOException("备份文件过大或资源损坏");out.write(b,0,n);}return out.toByteArray();}
 public static Content read(InputStream input)throws Exception{
  BufferedInputStream buffered=new BufferedInputStream(input);buffered.mark(4);int a=buffered.read(),b=buffered.read();buffered.reset();
  if(a!='P'||b!='K'){JSONObject data=new JSONObject(new String(bounded(buffered,4*1024*1024),StandardCharsets.UTF_8));validate(data);return new Content(data,new LinkedHashMap<>(),new ArrayList<>(),false);}
  Map<String,byte[]> entries=new LinkedHashMap<>();int total=0;ZipEntry entry;
  try(ZipInputStream zip=new ZipInputStream(buffered)){while((entry=zip.getNextEntry())!=null){String name=entry.getName();if(entry.isDirectory()||(!"manifest.json".equals(name)&&!ALLOWED.contains(name))||entries.containsKey(name))throw new IOException("备份包含不支持的资源");byte[] bytes=bounded(zip,limit(name));total+=bytes.length;if(total>MAX_TOTAL)throw new IOException("备份资源过大");entries.put(name,bytes);zip.closeEntry();}}
  byte[] manifest=entries.remove("manifest.json");if(manifest==null)throw new IOException("备份缺少清单");JSONObject j=new JSONObject(new String(manifest,StandardCharsets.UTF_8));if(!"course-assistant-backup".equals(j.optString("format"))||Store.integer(j,"version")!=2)throw new IOException("不支持的备份格式");JSONObject data=j.getJSONObject("data");validate(data);
  JSONArray names=j.getJSONArray("assets");Set<String> declared=new HashSet<>();for(int i=0;i<names.length();i++){String name=names.getString(i);if(!ALLOWED.contains(name)||!declared.add(name)||!entries.containsKey(name))throw new IOException("备份资源缺失或重复");}if(!declared.equals(entries.keySet()))throw new IOException("备份资源与清单不符");
  List<String> warnings=new ArrayList<>();JSONArray warningsJson=j.optJSONArray("warnings");if(warningsJson!=null)for(int i=0;i<warningsJson.length();i++)warnings.add(warningsJson.getString(i));
  if(entries.containsKey("drawing-draft.json"))SketchModel.read(new JSONObject(new String(entries.get("drawing-draft.json"),StandardCharsets.UTF_8)));
  if(entries.containsKey("import-draft.json"))ImportDraft.read(new JSONObject(new String(entries.get("import-draft.json"),StandardCharsets.UTF_8)));
  return new Content(data,entries,warnings,true);
 }
}
