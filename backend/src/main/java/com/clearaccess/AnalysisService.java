package com.clearaccess;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AnalysisService {
    private final AnalysisRunner runner;
    private final AnalysisRepository repository;

    public AnalysisService(AnalysisRunner runner, AnalysisRepository repository) {
        this.runner = runner;
        this.repository = repository;
    }

    public ObjectNode analyze(String url) {
        JsonNode output = runner.analyze(url);
        if (!(output instanceof ObjectNode result)) {
            throw new AnalysisException(HttpStatus.BAD_GATEWAY, "O analisador devolveu um resultado inválido.");
        }
        validateResult(result);
        UUID id = UUID.randomUUID();
        result.put("id", id.toString());
        repository.save(id, result);
        return result;
    }

    private void validateResult(ObjectNode result) {
        if (!result.path("url").isTextual() || result.path("url").asText().isBlank()
                || !result.path("title").isTextual() || !result.path("issues").isArray()
                || !nonnegativeInteger(result, "needsManualReview")
                || !nonnegativeInteger(result, "checkedRules")
                || !result.path("analyzedAt").isTextual()) {
            throw new AnalysisException(HttpStatus.BAD_GATEWAY, "O analisador devolveu um resultado inválido.");
        }
        try {
            Instant.parse(result.path("analyzedAt").asText());
        } catch (DateTimeParseException exception) {
            throw new AnalysisException(HttpStatus.BAD_GATEWAY, "O analisador devolveu um resultado inválido.");
        }
    }

    private boolean nonnegativeInteger(JsonNode result, String field) {
        return result.path(field).isIntegralNumber() && result.path(field).canConvertToInt()
                && result.path(field).intValue() >= 0;
    }

    public JsonNode findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new AnalysisException(HttpStatus.NOT_FOUND, "Análise não encontrada."));
    }

    public Optional<JsonNode> findPrevious(UUID id) {
        findById(id);
        return repository.findPrevious(id);
    }

    public List<AnalysisRepository.AnalysisSummary> findTimeline(UUID id) {
        findById(id);
        return repository.findTimeline(id);
    }

    public List<AnalysisRepository.AnalysisSummary> findRecent() {
        return repository.findRecent();
    }


    public AnalysisRepository.AnalysisPage search(String query, int page, String issues, String sort,
            String from, String to) {
        if (page < 0 || page > 10000 || query.length() > 200
                || !List.of("all", "with", "without").contains(issues)
                || !List.of("recent", "oldest", "most", "fewest").contains(sort)) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "Busca ou página inválida.");
        }
        Instant start = parseDate(from, false);
        Instant end = parseDate(to, true);
        if (start != null && end != null && !start.isBefore(end)) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "O período informado é inválido.");
        }
        return repository.search(query.trim(), page, issues, sort, start, end);
    }

    private Instant parseDate(String value, boolean exclusiveEnd) {
        if (value.isBlank()) return null;
        try {
            LocalDate date = LocalDate.parse(value);
            return (exclusiveEnd ? date.plusDays(1) : date).atStartOfDay().toInstant(ZoneOffset.UTC);
        } catch (DateTimeException | ArithmeticException exception) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "O período informado é inválido.");
        }
    }
}
