package cn.kecheng.assistant;
import android.content.*;import android.database.*;import android.net.Uri;import android.os.ParcelFileDescriptor;import android.provider.OpenableColumns;import java.io.*;

public final class BackupProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 private File file(Uri uri)throws FileNotFoundException{String name="/backup.zip".equals(uri.getPath())?"shared-backup.zip":"/backup.json".equals(uri.getPath())?"shared-backup.json":null;if(name==null)throw new FileNotFoundException("Unknown backup");File f=new File(getContext().getCacheDir(),name);if(!f.isFile())throw new FileNotFoundException("Backup not found");return f;}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("Read only");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 public String getType(Uri uri){return "/backup.zip".equals(uri.getPath())?"application/zip":"application/json";}
 public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){try{File f=file(uri);String[] columns=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor cursor=new MatrixCursor(columns);Object[] row=new Object[columns.length];for(int n=0;n<columns.length;n++)row[n]=OpenableColumns.DISPLAY_NAME.equals(columns[n])?("/backup.zip".equals(uri.getPath())?"Y课表备份.zip":"Y课表备份.json"):OpenableColumns.SIZE.equals(columns[n])?f.length():null;cursor.addRow(row);return cursor;}catch(Exception e){return null;}}
 public Uri insert(Uri uri,ContentValues v){throw new UnsupportedOperationException();}public int delete(Uri uri,String s,String[] args){throw new UnsupportedOperationException();}public int update(Uri uri,ContentValues v,String s,String[] args){throw new UnsupportedOperationException();}
}
