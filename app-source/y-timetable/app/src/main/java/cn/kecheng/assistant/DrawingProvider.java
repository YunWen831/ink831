package cn.kecheng.assistant;
import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;
import java.util.List;

public final class DrawingProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 private File file(Uri uri)throws FileNotFoundException{List<String> parts=uri.getPathSegments();if(parts.size()!=2||!"background".equals(parts.get(0))||!parts.get(1).matches("drawing-[a-f0-9-]+\\.png"))throw new FileNotFoundException("Unknown drawing");File file=new File(new File(getContext().getFilesDir(),"drawings"),parts.get(1));if(!file.isFile())throw new FileNotFoundException("Drawing not found");return file;}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("Read only");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 public String getType(Uri uri){return "image/png";}
 public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){try{File f=file(uri);String[] cols=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor result=new MatrixCursor(cols);Object[] row=new Object[cols.length];for(int i=0;i<cols.length;i++)row[i]=OpenableColumns.DISPLAY_NAME.equals(cols[i])?"涂鸦.png":OpenableColumns.SIZE.equals(cols[i])?f.length():null;result.addRow(row);return result;}catch(Exception e){return null;}}
 public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
