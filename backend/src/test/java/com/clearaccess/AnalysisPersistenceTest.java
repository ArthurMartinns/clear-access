package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.List;
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
        @Autowired
        private MockMvc mockMvc;
        @Autowired
        private ObjectMapper mapper;
        @MockitoBean
        private AnalysisRunner runner;
        @Autowired
        private AnalysisRepository repository;

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

        @Test
        void findsPreviousAnalysisForTheSamePage() throws Exception {
                List<String> dates = List.of("2026-11-10T13:00:00Z", "2026-11-11T13:00:00Z", "2026-11-12T13:00:00Z");
                List<String> urls = List.of("https://example.com/", "https://other.example/", "https://example.com/");
                UUID[] ids = new UUID[3];
                for (int index = 0; index < dates.size(); index++) {
                        String url = urls.get(index);
                        when(runner.analyze(url)).thenReturn(mapper.readTree("""
                                        {"url":"%s","title":"Página","issues":[],
                                         "needsManualReview":0,"checkedRules":12,"analyzedAt":"%s"}
                                        """.formatted(url, dates.get(index))));
                        String response = mockMvc.perform(post("/api/analyses")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(mapper.writeValueAsString(java.util.Map.of("url", url))))
                                        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                        ids[index] = UUID.fromString(mapper.readTree(response).path("id").asText());
                }

                mockMvc.perform(get("/api/analyses/" + ids[2] + "/previous"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(ids[0].toString()));
                mockMvc.perform(get("/api/analyses/" + ids[0] + "/previous"))
                                .andExpect(status().isNoContent());
                mockMvc.perform(get("/api/analyses/" + UUID.randomUUID() + "/previous"))
                                .andExpect(status().isNotFound());
        }

        @Test
        void searchesSavedHistoryAndValidatesPage() throws Exception {
                when(runner.analyze("https://example.com/"))
                                .thenReturn(mapper.readTree("""
                                                {"url":"https://example.com/","title":"Página Alfa","issues":[],
                                                 "needsManualReview":0,"checkedRules":12,"analyzedAt":"2026-11-12T13:00:00Z"}
                                                """));
                mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON)
                                .content("{\"url\":\"https://example.com/\"}"))
                                .andExpect(status().isCreated());

                mockMvc.perform(get("/api/analyses/history").param("q", "ALFA"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.total").value(1))
                                .andExpect(jsonPath("$.items[0].title").value("Página Alfa"));
                mockMvc.perform(get("/api/analyses/history").param("q", "inexistente"))
                                .andExpect(jsonPath("$.total").value(0));
                mockMvc.perform(get("/api/analyses/history").param("page", "-1"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void paginatesHistoryAfterTwentyResults() throws Exception {
                for (int index = 0; index < 21; index++) {
                        var result = mapper.createObjectNode();
                        result.put("url", "https://example.com/" + index);
                        result.put("title", "Página " + index);
                        result.put("analyzedAt", "2026-11-12T13:00:00Z");
                        result.putArray("issues");
                        result.put("needsManualReview", 0);
                        result.put("checkedRules", 1);
                        repository.save(UUID.randomUUID(), result);
                }
                mockMvc.perform(get("/api/analyses/history").param("page", "1"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.total").value(21))
                                .andExpect(jsonPath("$.items.length()").value(1));
        }
}
