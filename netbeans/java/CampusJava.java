import javax.tools.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

public class CampusJava {
  private static Path directory;
  private static final List<File> sources=new ArrayList<>();
  public static void reset() throws Exception {
    if(directory!=null)try(var paths=Files.walk(directory)){paths.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.deleteIfExists(p);}catch(IOException ignored){}});}
    directory=Paths.get("/files/campus-java-"+UUID.randomUUID());Files.createDirectories(directory.resolve("classes"));sources.clear();
  }
  public static void addSource(String name,String code)throws Exception {
    if(!name.matches("(?:[A-Za-z_$][\\w$]*/)*(?:[A-Za-z_$][\\w$]*|package-info|module-info)\\.java"))throw new IllegalArgumentException("Ruta Java no válida");
    Path target=directory.resolve("sources").resolve(name);Files.createDirectories(target.getParent());Files.writeString(target,code,StandardCharsets.UTF_8);sources.add(target.toFile());
  }
  private static String q(String s){if(s==null)return "null";StringBuilder b=new StringBuilder("\"");for(char c:s.toCharArray()){switch(c){case '\"':b.append("\\\"");break;case '\\':b.append("\\\\");break;case '\n':b.append("\\n");break;case '\r':b.append("\\r");break;case '\t':b.append("\\t");break;default:if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}}return b.append('"').toString();}
  private static native String readConsoleLine();
  private static native void publishConsole(int channel,String text);
  static class ConsoleInput extends InputStream {
    private byte[] buffer=new byte[0];
    private int position;
    private boolean eof;
    private boolean refill() {
      if(position<buffer.length)return true;
      if(eof)return false;
      String line=readConsoleLine();
      if(line==null){eof=true;return false;}
      buffer=(line+"\n").getBytes(StandardCharsets.UTF_8);position=0;return true;
    }
    public int read(){return refill()?buffer[position++]&255:-1;}
    public int read(byte[] bytes,int offset,int length){
      Objects.checkFromIndexSize(offset,length,bytes.length);
      if(length==0)return 0;
      if(!refill())return -1;
      int count=Math.min(length,buffer.length-position);
      System.arraycopy(buffer,position,bytes,offset,count);position+=count;return count;
    }
    public int available(){return buffer.length-position;}
  }
  static class LimitedOutput extends OutputStream {
    final ByteArrayOutputStream data=new ByteArrayOutputStream();
    final int channel;
    LimitedOutput(int channel){this.channel=channel;}
    public void write(int b){if(data.size()>=128000)throw new IllegalStateException("Límite de salida alcanzado");data.write(b);}
    public void write(byte[] bytes,int offset,int length){
      if(data.size()+length>128000)throw new IllegalStateException("Límite de salida alcanzado");
      data.write(bytes,offset,length);
    }
    public void flush(){if(channel>=0)publishConsole(channel,text());}
    public String text(){return data.toString(StandardCharsets.UTF_8);}
  }
  public static String execute(String mainClass,String input,boolean checkOnly)throws Exception {
    JavaCompiler compiler=(JavaCompiler)Class.forName("com.sun.tools.javac.api.JavacTool").getMethod("create").invoke(null);
    DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();StringWriter log=new StringWriter();boolean compiled;
    Path classes=directory.resolve("classes");
    try(StandardJavaFileManager fm=compiler.getStandardFileManager(diagnostics,Locale.ENGLISH,StandardCharsets.UTF_8)){
      compiled=compiler.getTask(log,fm,diagnostics,Arrays.asList("-proc:none","-encoding","UTF-8","-d",classes.toString()),null,fm.getJavaFileObjectsFromFiles(sources)).call();
    }
    StringBuilder list=new StringBuilder("[");
    for(Diagnostic<? extends JavaFileObject> d:diagnostics.getDiagnostics()){
      if(list.length()>1)list.append(',');String file=d.getSource()==null?"":d.getSource().getName().replace(directory.resolve("sources").toString()+"/","");
      list.append("{\"file\":").append(q(file)).append(",\"line\":").append(Math.max(1,d.getLineNumber())).append(",\"column\":").append(Math.max(1,d.getColumnNumber())).append(",\"severity\":").append(q(d.getKind()==Diagnostic.Kind.ERROR?"error":"warning")).append(",\"message\":").append(q(d.getMessage(Locale.ENGLISH))).append('}');
      log.append(file+":"+d.getLineNumber()+": "+d.getMessage(Locale.ENGLISH)+"\n");
    }
    list.append(']');LimitedOutput out=new LimitedOutput(input==null?0:-1),err=new LimitedOutput(input==null?1:-1);int exit=compiled?0:1;
    if(compiled&&!checkOnly){
      PrintStream previousOut=System.out,previousErr=System.err;InputStream previousIn=System.in;
      try(URLClassLoader loader=new URLClassLoader(new URL[]{classes.toUri().toURL()},ClassLoader.getPlatformClassLoader())){
        System.setIn(input==null?new ConsoleInput():new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8)));System.setOut(new PrintStream(out,true,"UTF-8"));System.setErr(new PrintStream(err,true,"UTF-8"));
        Class<?> main=Class.forName(mainClass,true,loader);
        Method entry=main.getMethod("main",String[].class);
        if(!Modifier.isStatic(entry.getModifiers()) || entry.getReturnType()!=void.class)
          throw new IllegalArgumentException("El método main debe ser public static void main(String[] args).");
        // Java's launcher accepts a package-private class with a public main.
        // The bridge lives in another package, so reflective invocation needs access.
        entry.setAccessible(true);
        entry.invoke(null,(Object)new String[0]);
      }catch(Throwable failure){exit=1;Throwable actual=failure instanceof InvocationTargetException?failure.getCause():failure;try{actual.printStackTrace(new PrintStream(err,true,"UTF-8"));}catch(Throwable ignored){}}
      finally{System.setOut(previousOut);System.setErr(previousErr);System.setIn(previousIn);}
    }
    return "{\"compiled\":"+compiled+",\"diagnostics\":"+list+",\"compilerOutput\":"+q(log.toString())+",\"stdout\":"+q(out.text())+",\"stderr\":"+q(err.text())+",\"exitCode\":"+exit+",\"timedOut\":false}";
  }
}
