package com.clearaccess;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
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

    public Optional<JsonNode> findPrevious(UUID id) {
        List<String> rows = jdbc.query("""
                SELECT older.result_json FROM analyses older
                JOIN analyses current_analysis ON current_analysis.id = ?
                WHERE older.url = current_analysis.url
                  AND (older.analyzed_at < current_analysis.analyzed_at
                    OR (older.analyzed_at = current_analysis.analyzed_at AND older.id < current_analysis.id))
                ORDER BY older.analyzed_at DESC, older.id DESC LIMIT 1
                """, (rs, rowNum) -> rs.getString("result_json"), id);
        return rows.stream().findFirst().map(this::parseResult);
    }

    public List<AnalysisSummary> findTimeline(UUID id) {
        return jdbc.query("""
                SELECT older.id, older.url, older.title, older.analyzed_at, older.issue_count,
                       older.needs_manual_review, older.checked_rules
                FROM analyses older
                JOIN analyses selected ON selected.id = ?
                WHERE older.url = selected.url
                  AND (older.analyzed_at < selected.analyzed_at
                    OR (older.analyzed_at = selected.analyzed_at AND older.id <= selected.id))
                ORDER BY older.analyzed_at DESC, older.id DESC LIMIT 10
                """, (rs, rowNum) -> new AnalysisSummary(
                rs.getObject("id", UUID.class), rs.getString("url"), rs.getString("title"),
                rs.getTimestamp("analyzed_at").toInstant(), rs.getInt("issue_count"),
                rs.getInt("needs_manual_review"), rs.getInt("checked_rules")), id);
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

    public AnalysisPage search(String query, int page, String issues, String sort, Instant from, Instant to) {
        String term = "%" + query.toLowerCase(java.util.Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        StringBuilder where = new StringBuilder("WHERE (LOWER(url) LIKE ? ESCAPE '\\' OR LOWER(title) LIKE ? ESCAPE '\\')");
        List<Object> parameters = new ArrayList<>(List.of(term, term));
        if (issues.equals("with")) where.append(" AND issue_count > 0");
        if (issues.equals("without")) where.append(" AND issue_count = 0");
        if (from != null) {
            where.append(" AND analyzed_at >= ?");
            parameters.add(Timestamp.from(from));
        }
        if (to != null) {
            where.append(" AND analyzed_at < ?");
            parameters.add(Timestamp.from(to));
        }
        String order = switch (sort) {
            case "oldest" -> "analyzed_at ASC, id ASC";
            case "most" -> "issue_count DESC, analyzed_at DESC, id DESC";
            case "fewest" -> "issue_count ASC, analyzed_at DESC, id DESC";
            default -> "analyzed_at DESC, id DESC";
        };
        int total = jdbc.queryForObject("SELECT COUNT(*) FROM analyses " + where,
                Integer.class, parameters.toArray());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(20);
        pageParameters.add(page * 20);
        List<AnalysisSummary> items = jdbc.query("""
                SELECT id, url, title, analyzed_at, issue_count, needs_manual_review, checked_rules
                FROM analyses
                """ + where + " ORDER BY " + order + " LIMIT ? OFFSET ?",
                (rs, rowNum) -> new AnalysisSummary(
                        rs.getObject("id", UUID.class), rs.getString("url"), rs.getString("title"),
                        rs.getTimestamp("analyzed_at").toInstant(), rs.getInt("issue_count"),
                        rs.getInt("needs_manual_review"), rs.getInt("checked_rules")),
                pageParameters.toArray());
        return new AnalysisPage(items, page, 20, total);
    }

    private JsonNode parseResult(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("O resultado salvo está inválido.", exception);
        }
    }

    public record AnalysisSummary(UUID id, String url, String title, Instant analyzedAt,
            int issueCount, int needsManualReview, int checkedRules) {
    }

    public record AnalysisPage(List<AnalysisSummary> items, int page, int size, int total) {
    }
}
