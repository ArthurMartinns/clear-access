package com.clearaccess;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AnalysisErrorHandler {
    @ExceptionHandler(AnalysisException.class)
    public ResponseEntity<ErrorResponse> handle(AnalysisException exception) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(exception.status());
        if (exception.status() == HttpStatus.TOO_MANY_REQUESTS) {
            response.header("Retry-After", "10");
        }
        return response.body(new ErrorResponse(exception.getMessage()));
    }

    public record ErrorResponse(String error) {}
}
