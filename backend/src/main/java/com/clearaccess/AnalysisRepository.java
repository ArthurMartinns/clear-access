package com.clearaccess;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AnalysisRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AnalysisRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void save(UUID id, JsonNode result) {
        jdbc.update("""
                INSERT INTO analyses (id, url, title, analyzed_at, issue_count,
                                      needs_manual_review, checked_rules, result_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id,
                result.path("url").asText(),
                result.path("title").asText(),
                Timestamp.from(Instant.parse(result.path("analyzedAt").asText())),
                result.path("issues").size(),
                result.path("needsManualReview").asInt(),
                result.path("checkedRules").asInt(),
                result.toString());
    }

    public Optional<JsonNode> findById(UUID id) {
        List<String> rows = jdbc.query(
                "SELECT result_json FROM analyses WHERE id = ?",
                (rs, rowNum) -> rs.getString("result_json"), id);
        return rows.stream().findFirst().map(this::parseResult);
    }

    public List<AnalysisSummary> findRecent() {
        return jdbc.query("""
                SELECT id, url, title, analyzed_at, issue_count, needs_manual_review, checked_rules
                FROM analyses ORDER BY analyzed_at DESC, id DESC LIMIT 20
                """, (rs, rowNum) -> new AnalysisSummary(
                rs.getObject("id", UUID.class),
                rs.getString("url"),
                rs.getString("title"),
                rs.getTimestamp("analyzed_at").toInstant(),
                rs.getInt("issue_count"),
                rs.getInt("needs_manual_review"),
                rs.getInt("checked_rules")));
    }

    private JsonNode parseResult(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("O resultado salvo está inválido.", exception);
        }
    }

    public record AnalysisSummary(UUID id, String url, String title, Instant analyzedAt,
                                  int issueCount, int needsManualReview, int checkedRules) {}
}
