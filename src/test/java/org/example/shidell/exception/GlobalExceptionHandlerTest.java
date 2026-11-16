package org.example.shidell.exception;

import jakarta.servlet.RequestDispatcher;
import org.example.shidell.config.AuthInterceptor;
import org.example.shidell.controller.CustomErrorController;
import org.example.shidell.service.AuthSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {
        CustomErrorController.class,
        GlobalExceptionHandlerTest.TestThrowController.class
})
@Import({
        AuthInterceptor.class,
        GlobalExceptionHandler.class,
        GlobalExceptionHandlerTest.TestThrowController.class
})
@DisplayName("Pruebas WebMvc - Errores amigables y sin fugas técnicas")
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthSessionService authSessionService;

    @RestController
    static class TestThrowController {
        @GetMapping("/api/auth/test-boom")
        public String apiBoom() {
            throw new RuntimeException("org.hibernate.SQLGrammarException: relation demo1_bad does not exist");
        }

        @GetMapping("/pagina-desconocida")
        public String webNotFound() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "/pagina-desconocida");
        }
    }

    @Test
    @DisplayName("API 500 oculta trazas SQL/Java y responde lenguaje amigable")
    void apiError500_ocultaDetallesTecnicos() throws Exception {
        mockMvc.perform(get("/api/auth/test-boom")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error", not(containsString("SQL"))))
                .andExpect(jsonPath("$.error", not(containsString("hibernate"))))
                .andExpect(jsonPath("$.error", containsString("intent")));
    }

    @Test
    @DisplayName("Navegador HTML en ruta inexistente recibe diseño amigable 404 en vez de JSON")
    void webNotFound_devuelveHtmlPersonalizado() throws Exception {
        mockMvc.perform(get("/pagina-desconocida")
                        .accept(MediaType.TEXT_HTML))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("error-page.js")))
                .andExpect(content().string(containsString("data-error-code=\"404\"")));
    }

    @Test
    @DisplayName("Controlador /error devuelve página ilustrada 403/500 para navegadores")
    void errorController_devuelveHtmlParaNavegador() throws Exception {
        mockMvc.perform(get("/error")
                        .requestAttr(RequestDispatcher.ERROR_STATUS_CODE, 403)
                        .accept(MediaType.TEXT_HTML))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("data-error-code=\"403\"")));
    }
}
