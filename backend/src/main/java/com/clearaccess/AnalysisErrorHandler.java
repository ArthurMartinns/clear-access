package com.clearaccess;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AnalysisErrorHandler {
    @ExceptionHandler(AnalysisException.class)
    public ResponseEntity<ErrorResponse> handle(AnalysisException exception) {
        return ResponseEntity.status(exception.status()).body(new ErrorResponse(exception.getMessage()));
    }

    public record ErrorResponse(String error) {}
}
