package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalysisController.class)
class AnalysisControllerTest {
        @Autowired
        private MockMvc mockMvc;
        @Autowired
        private ObjectMapper mapper;
        @MockitoBean
        private AnalysisService service;

        @Test
        void returnsAnalysisResult() throws Exception {
                ObjectNode result = (ObjectNode) mapper.readTree("{\"url\":\"https://example.com/\",\"issues\":[]}");
                UUID id = UUID.randomUUID();
                result.put("id", id.toString());
                when(service.analyze("https://example.com/")).thenReturn(result);

                mockMvc.perform(post("/api/analyses")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"url\":\"https://example.com/\"}"))
                                .andExpect(status().isCreated())
                                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                                                .string("Location", "/api/analyses/" + id))
                                .andExpect(jsonPath("$.url").value("https://example.com/"))
                                .andExpect(jsonPath("$.issues").isArray());
                verify(service).analyze("https://example.com/");
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
                when(service.analyze(anyString()))
                                .thenThrow(new AnalysisException(org.springframework.http.HttpStatus.BAD_REQUEST,
                                                "Destinos internos não podem ser analisados."));
                mockMvc.perform(post("/api/analyses")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"url\":\"http://localhost/\"}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Destinos internos não podem ser analisados."));
        }

        @Test
        void listsRecentAnalyses() throws Exception {
                when(service.findRecent()).thenReturn(List.of());
                mockMvc.perform(get("/api/analyses"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray());
        }

        @Test
        void returnsNotFoundForUnknownId() throws Exception {
                UUID id = UUID.randomUUID();
                when(service.findById(id))
                                .thenThrow(new AnalysisException(org.springframework.http.HttpStatus.NOT_FOUND,
                                                "Análise não encontrada."));
                mockMvc.perform(get("/api/analyses/" + id))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.error").value("Análise não encontrada."));
        }
}
