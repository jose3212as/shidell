package org.example.shidell;

import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Suite principal de pruebas del Sistema Shidell.
 *
 * Ejecuta automáticamente todos los tests de los módulos:
 *   - service   → AuthSessionService, DocenteService, EntregaService,
 *                 MensajeService, NotificacionService, UserService
 *   - controller → AsistenciaController, AuthController, CalificacionController,
 *                  MensajeController, TareaController
 *   - repository → EntregaRepository, UserRepository
 *   - mapper     → EntityMapper
 *
 * Cómo ejecutar desde NetBeans:
 *   Clic derecho sobre este archivo → "Test File"
 *
 * Cómo ejecutar desde terminal:
 *   mvn test
 */
@Suite
@SuiteDisplayName("Suite Completa - Sistema Shidell (87 tests)")
@SelectPackages({
        "org.example.shidell.service",
        "org.example.shidell.controller",
        "org.example.shidell.repository",
        "org.example.shidell.mapper"
})
public class ShidellTestSuite {
    // Esta clase no necesita código.
    // JUnit Platform descubre y ejecuta todos los tests de los paquetes indicados.
}
