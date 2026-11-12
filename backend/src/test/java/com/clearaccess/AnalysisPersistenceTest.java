package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AnalysisPersistenceTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @MockitoBean private AnalysisRunner runner;

    @Test
    void savesAndRetrievesAnalysis() throws Exception {
        when(runner.analyze("https://example.com/"))
                .thenReturn(mapper.readTree("""
                        {"url":"https://example.com/","title":"Example Domain",
                         "issues":[{"ruleId":"image-alt","impact":"serious"}],
                         "needsManualReview":1,"checkedRules":12,
                         "analyzedAt":"2026-11-12T13:00:00Z"}
                        """));

        String response = mockMvc.perform(post("/api/analyses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://example.com/\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Example Domain"))
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(mapper.readTree(response).path("id").asText());

        mockMvc.perform(get("/api/analyses/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issues[0].ruleId").value("image-alt"));
        mockMvc.perform(get("/api/analyses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()))
                .andExpect(jsonPath("$[0].issueCount").value(1));
    }
}
