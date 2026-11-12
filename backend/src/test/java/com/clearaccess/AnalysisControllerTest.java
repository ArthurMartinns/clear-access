package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalysisController.class)
class AnalysisControllerTest {
        @Autowired
        private MockMvc mockMvc;
        @Autowired
        private ObjectMapper mapper;
        @MockitoBean
        private AnalysisRunner runner;

        @Test
        void returnsAnalysisResult() throws Exception {
                when(runner.analyze("https://example.com/"))
                                .thenReturn(mapper.readTree("{\"url\":\"https://example.com/\",\"issues\":[]}"));

                mockMvc.perform(post("/api/analyses")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"url\":\"https://example.com/\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.url").value("https://example.com/"))
                                .andExpect(jsonPath("$.issues").isArray());
                verify(runner).analyze("https://example.com/");
        }

        @Test
        void rejectsMissingUrl() throws Exception {
                mockMvc.perform(post("/api/analyses")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Informe uma URL."));
        }

        @Test
        void returnsTargetValidationError() throws Exception {
                when(runner.analyze(anyString()))
                                .thenThrow(new AnalysisException(org.springframework.http.HttpStatus.BAD_REQUEST,
                                                "Destinos internos não podem ser analisados."));
                mockMvc.perform(post("/api/analyses")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"url\":\"http://localhost/\"}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Destinos internos não podem ser analisados."));
        }
}
