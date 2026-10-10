import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;
public class MainAccessTest {
  static void check(String declaration, String body, boolean succeeds) throws Exception {
    Path dir=Files.createTempDirectory("campus-java-test-"); Files.createDirectories(dir.resolve("classes"));
    Field directory=CampusJava.class.getDeclaredField("directory");directory.setAccessible(true);directory.set(null,dir);
    Field sources=CampusJava.class.getDeclaredField("sources");sources.setAccessible(true);((List<?>)sources.get(null)).clear();
    try {
      CampusJava.addSource("fabrizio/Ejercicio5.java","package fabrizio; import java.util.Scanner; "+declaration+" class Ejercicio5 { "+body+" }");
      String result=CampusJava.execute("fabrizio.Ejercicio5","100\n",false);
      if(!result.contains("\"exitCode\":"+(succeeds?0:1)))throw new AssertionError(result);
      if(succeeds && !result.contains("121.00 / 108.90"))throw new AssertionError(result);
    } finally {try(var paths=Files.walk(dir)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.delete(p);}}
  }
  public static void main(String[] args)throws Exception {
    Locale.setDefault(Locale.US);
    String body="public static void main(String[] args) { double precio=new Scanner(System.in).nextDouble(); double iva=precio*1.21; double descuento=iva*0.90; System.out.printf(\"%.2f / %.2f\",iva,descuento); }";
    check("",body,true); check("public",body,true);
    check("","private static void main(String[] args) {}",false);
    check("","public void main(String[] args) {}",false);
    System.out.println("PASS: package-private and public classes, Scanner, printf; invalid main rejected.");
  }
}
