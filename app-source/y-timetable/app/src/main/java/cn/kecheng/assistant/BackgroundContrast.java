package cn.kecheng.assistant;

public final class BackgroundContrast {
 public static float overlay(int shade,float brightness){float base=BackgroundGeometry.clamp(brightness,0,1)*220/255f;float level=Math.max(0,Math.min(255,shade));float lit=level+(255-level)*base;return lit>=180?0:Math.min(.72f,(180-lit)/(255-lit));}
 public static int shade(int color){return (int)(.2126*((color>>16)&255)+.7152*((color>>8)&255)+.0722*(color&255));}
}
