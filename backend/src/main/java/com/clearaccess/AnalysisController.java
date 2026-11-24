package com.clearaccess;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {
    private final AnalysisService service;

    public AnalysisController(AnalysisService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<JsonNode> analyze(@RequestBody AnalysisRequest request) {
        if (request == null || request.url() == null || request.url().isBlank()) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "Informe uma URL.");
        }
        String url = request.url().trim();
        if (url.length() > 2048) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "A URL deve ter até 2048 caracteres.");
        }
        JsonNode result = service.analyze(url);
        return ResponseEntity.created(URI.create("/api/analyses/" + result.path("id").asText())).body(result);
    }

    @GetMapping
    public List<AnalysisRepository.AnalysisSummary> recent() {
        return service.findRecent();
    }

    @GetMapping("/history")
    public AnalysisRepository.AnalysisPage history(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "all") String issues,
            @RequestParam(defaultValue = "recent") String sort,
            @RequestParam(defaultValue = "") String from,
            @RequestParam(defaultValue = "") String to) {
        return service.search(q, page, issues, sort, from, to);
    }

    @GetMapping("/{id}")
    public JsonNode byId(@PathVariable UUID id) {
        return service.findById(id);
    }

    @GetMapping("/{id}/previous")
    public ResponseEntity<JsonNode> previous(@PathVariable UUID id) {
        Optional<JsonNode> previous = service.findPrevious(id);
        return previous.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}/timeline")
    public List<AnalysisRepository.AnalysisSummary> timeline(@PathVariable UUID id) {
        return service.findTimeline(id);
    }

    public record AnalysisRequest(String url) {
    }
}
