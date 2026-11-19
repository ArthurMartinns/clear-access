package com.clearaccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnalysisRunnerTest {
    @TempDir
    Path directory;

    @Test
    void rejectsAdditionalAnalysisWhenWorkerIsBusy() throws Exception {
        Path marker = directory.resolve("started.txt");
        Path script = directory.resolve("slow-worker.mjs");
        Files.writeString(script, """
                import { writeFileSync } from 'node:fs';
                writeFileSync(process.argv[2], 'ready');
                await new Promise(resolve => setTimeout(resolve, 1200));
                console.log('{}');
                """);
        AnalysisRunner runner = new AnalysisRunner(new ObjectMapper(), script.toString(), 1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var first = executor.submit(() -> runner.analyze(marker.toString()));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (!Files.exists(marker) && System.nanoTime() < deadline) {
                Thread.sleep(10);
            }
            assertTrue(Files.exists(marker), "O worker de teste não iniciou.");
            AnalysisException error = assertThrows(AnalysisException.class,
                    () -> runner.analyze(marker.toString()));
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.status());
            assertTrue(first.get(5, TimeUnit.SECONDS).isObject());
        }
    }
}
