package com.clearaccess;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AnalysisRunner {
    private static final Duration TIMEOUT = Duration.ofSeconds(60);
    private final ObjectMapper mapper;
    private final Path script;
    private final Semaphore slots;

    public AnalysisRunner(ObjectMapper mapper,
            @Value("${clearaccess.worker.script:../worker/analyze.mjs}") String script,
            @Value("${clearaccess.worker.max-concurrent:2}") int maxConcurrent) {
        this.mapper = mapper;
        this.script = Path.of(script).toAbsolutePath().normalize();
        this.slots = new Semaphore(Math.max(1, maxConcurrent));
    }

    public JsonNode analyze(String url) {
        if (!slots.tryAcquire()) {
            throw new AnalysisException(HttpStatus.TOO_MANY_REQUESTS,
                    "O analisador está ocupado. Tente novamente em instantes.");
        }
        Path output = null;
        Path errors = null;
        Process process = null;
        try {
            output = Files.createTempFile("clearaccess-output-", ".json");
            errors = Files.createTempFile("clearaccess-errors-", ".txt");
            process = new ProcessBuilder("node", script.toString(), url)
                    .redirectOutput(output.toFile())
                    .redirectError(errors.toFile())
                    .start();
            if (!process.waitFor(TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
                stopProcess(process);
                process.waitFor();
                throw new AnalysisException(HttpStatus.GATEWAY_TIMEOUT, "A análise excedeu o tempo limite.");
            }
            if (process.exitValue() != 0) {
                String message = Files.readString(errors).trim();
                HttpStatus status = process.exitValue() == 2 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY;
                throw new AnalysisException(status,
                        message.isEmpty() ? "Não foi possível analisar a página." : message);
            }
            return mapper.readTree(Files.readString(output));
        } catch (IOException exception) {
            throw new AnalysisException(HttpStatus.BAD_GATEWAY, "O analisador não está disponível.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AnalysisException(HttpStatus.INTERNAL_SERVER_ERROR, "A análise foi interrompida.");
        } finally {
            if (process != null && process.isAlive())
                stopProcess(process);
            deleteQuietly(output);
            deleteQuietly(errors);
            slots.release();
        }
    }

    private void stopProcess(Process process) {
        process.descendants().forEach(ProcessHandle::destroyForcibly);
        process.destroyForcibly();
    }

    private void deleteQuietly(Path path) {
        if (path != null) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException ignored) {
            }
        }
    }
}
