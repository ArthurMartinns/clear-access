package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AnalysisServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AnalysisRunner runner = mock(AnalysisRunner.class);
    private final AnalysisRepository repository = mock(AnalysisRepository.class);
    private final AnalysisService service = new AnalysisService(runner, repository);

    @Test
    void rejectsMalformedWorkerOutputBeforeSaving() throws Exception {
        when(runner.analyze("https://example.com/")).thenReturn(mapper.readTree("""
                {"url":"https://example.com/","title":"Example","issues":[],
                 "needsManualReview":-1,"checkedRules":3,"analyzedAt":"not-a-date"}
                """));

        AnalysisException error = assertThrows(AnalysisException.class,
                () -> service.analyze("https://example.com/"));
        assertEquals(HttpStatus.BAD_GATEWAY, error.status());
        verifyNoInteractions(repository);
    }
}
