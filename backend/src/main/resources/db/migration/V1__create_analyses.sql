CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    issue_count INTEGER NOT NULL,
    needs_manual_review INTEGER NOT NULL,
    checked_rules INTEGER NOT NULL,
    result_json TEXT NOT NULL
);

CREATE INDEX idx_analyses_analyzed_at ON analyses (analyzed_at DESC);
CREATE INDEX idx_analyses_url_analyzed_at ON analyses (url, analyzed_at DESC);
