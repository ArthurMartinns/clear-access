package com.clearaccess;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {
    private final AnalysisRunner runner;

    public AnalysisController(AnalysisRunner runner) {
        this.runner = runner;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public JsonNode analyze(@RequestBody AnalysisRequest request) {
        if (request == null || request.url() == null || request.url().isBlank()) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "Informe uma URL.");
        }
        return runner.analyze(request.url());
    }

    public record AnalysisRequest(String url) {}
}
