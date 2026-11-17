package com.clearaccess;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
        UUID id = UUID.randomUUID();
        result.put("id", id.toString());
        repository.save(id, result);
        return result;
    }

    public JsonNode findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new AnalysisException(HttpStatus.NOT_FOUND, "Análise não encontrada."));
    }

    public Optional<JsonNode> findPrevious(UUID id) {
        findById(id);
        return repository.findPrevious(id);
    }

    public List<AnalysisRepository.AnalysisSummary> findRecent() {
        return repository.findRecent();
    }


    public AnalysisRepository.AnalysisPage search(String query, int page) {
        if (page < 0 || page > 10000 || query.length() > 200) {
            throw new AnalysisException(HttpStatus.BAD_REQUEST, "Busca ou página inválida.");
        }
        return repository.search(query.trim(), page);
    }
}
