import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class CleanDB {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://localhost:5432/demo1";
        String user = "postgres";
        String password = "Joseelmer31";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            int deleted = stmt.executeUpdate("DELETE FROM usuarios WHERE rol = 'DOCENTE' AND email LIKE '%@shidell.edu' AND id NOT IN (SELECT DISTINCT profesor_id FROM cursos WHERE profesor_id IS NOT NULL)");
            System.out.println("Docentes eliminados exitosamente: " + deleted);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
