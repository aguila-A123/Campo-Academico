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
  static class LimitedOutput extends OutputStream {
    final ByteArrayOutputStream data=new ByteArrayOutputStream();
    public void write(int b){if(data.size()>=128000)throw new IllegalStateException("Límite de salida alcanzado");data.write(b);}
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
    list.append(']');LimitedOutput out=new LimitedOutput(),err=new LimitedOutput();int exit=compiled?0:1;
    if(compiled&&!checkOnly){
      PrintStream previousOut=System.out,previousErr=System.err;InputStream previousIn=System.in;
      try(URLClassLoader loader=new URLClassLoader(new URL[]{classes.toUri().toURL()},ClassLoader.getPlatformClassLoader())){
        System.setIn(new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8)));System.setOut(new PrintStream(out,true,"UTF-8"));System.setErr(new PrintStream(err,true,"UTF-8"));
        Class<?> main=Class.forName(mainClass,true,loader);main.getMethod("main",String[].class).invoke(null,(Object)new String[0]);
      }catch(Throwable failure){exit=1;Throwable actual=failure instanceof InvocationTargetException?failure.getCause():failure;try{actual.printStackTrace(new PrintStream(err,true,"UTF-8"));}catch(Throwable ignored){}}
      finally{System.setOut(previousOut);System.setErr(previousErr);System.setIn(previousIn);}
    }
    return "{\"compiled\":"+compiled+",\"diagnostics\":"+list+",\"compilerOutput\":"+q(log.toString())+",\"stdout\":"+q(out.text())+",\"stderr\":"+q(err.text())+",\"exitCode\":"+exit+",\"timedOut\":false}";
  }
}
