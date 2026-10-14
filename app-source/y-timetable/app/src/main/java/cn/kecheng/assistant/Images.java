package cn.kecheng.assistant;
import android.content.Context;
import android.graphics.*;
import android.media.ExifInterface;
import android.net.Uri;
import java.io.*;

public final class Images {
 public static Bitmap read(Context c,Uri uri)throws IOException{
  BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;
  try(InputStream in=c.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,o);}
  if(o.outWidth<1||o.outHeight<1)throw new IOException("不是可读取的图片");
  o.inSampleSize=1;while(Math.max(o.outWidth,o.outHeight)/o.inSampleSize>2048)o.inSampleSize*=2;o.inJustDecodeBounds=false;
  Bitmap bitmap;try(InputStream in=c.getContentResolver().openInputStream(uri)){bitmap=BitmapFactory.decodeStream(in,null,o);}
  if(bitmap==null)throw new IOException("图片无法读取");int orientation=1;
  try(InputStream in=c.getContentResolver().openInputStream(uri)){orientation=new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION,1);}catch(IOException ignored){}
  Matrix m=new Matrix();switch(orientation){case 2:m.setScale(-1,1);break;case 3:m.setRotate(180);break;case 4:m.setScale(1,-1);break;case 5:m.setRotate(90);m.postScale(-1,1);break;case 6:m.setRotate(90);break;case 7:m.setRotate(270);m.postScale(-1,1);break;case 8:m.setRotate(270);break;default:return bitmap;}
  Bitmap rotated=Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),m,true);if(rotated!=bitmap)bitmap.recycle();return rotated;
 }
}
