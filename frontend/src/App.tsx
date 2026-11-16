import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { compareIssues } from "./compare";

type Impact = "critical" | "serious" | "moderate" | "minor";

type Issue = {
  ruleId: string;
  impact: Impact | string;
  category: string;
  title: string;
  description: string;
  helpUrl: string;
  selector: string;
  element: string;
  why: string;
  howToFix: string;
};

type Analysis = {
  id: string;
  url: string;
  title: string;
  issues: Issue[];
  needsManualReview: number;
  checkedRules: number;
  analyzedAt: string;
};

type AnalysisSummary = {
  id: string;
  url: string;
  title: string;
  analyzedAt: string;
  issueCount: number;
  needsManualReview: number;
  checkedRules: number;
};

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Não foi possível carregar os dados.");
  }
  return body as T;
}

function reportIdFromUrl() {
  return new URL(window.location.href).searchParams.get("analysis");
}

function setReportUrl(id: string | null) {
  const next = new URL(window.location.href);
  if (id) next.searchParams.set("analysis", id);
  else next.searchParams.delete("analysis");
  window.history.pushState({}, "", next);
}

function demoUrl() {
  const origin = new URL(window.location.origin);
  if (origin.hostname === "127.0.0.1" && origin.port === "5173") {
    origin.hostname = "localhost";
  }
  return new URL("/demo/broken.html", origin).href;
}

const impacts: { id: Impact; label: string }[] = [
  { id: "critical", label: "Crítico" },
  { id: "serious", label: "Grave" },
  { id: "moderate", label: "Moderado" },
  { id: "minor", label: "Menor" },
];

const categoryNames: Record<string, string> = {
  aria: "ARIA",
  color: "Cor",
  forms: "Formulários",
  keyboard: "Teclado",
  language: "Idioma",
  "name-role-value": "Nome e função",
  parsing: "Estrutura",
  semantics: "Semântica",
  "sensory-and-visual-cues": "Sinais visuais",
  structure: "Estrutura",
  tables: "Tabelas",
  "text-alternatives": "Texto alternativo",
  "time-and-media": "Tempo e mídia",
  "best-practice": "Boas práticas",
};

function categoryLabel(category: string) {
  return categoryNames[category] ?? category;
}

function impactLabel(impact: string) {
  return impacts.find((item) => item.id === impact)?.label ?? impact;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function App() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(reportIdFromUrl);
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [previous, setPrevious] = useState<Analysis | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const requestSequence = useRef(0);
  const [filter, setFilter] = useState<Impact | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setHistory(
        await readResponse<AnalysisSummary[]>(await fetch("/api/analyses")),
      );
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o histórico.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadReport(id: string | null, known?: Analysis) {
    const sequence = ++requestSequence.current;
    setSelectedId(id);
    setPrevious(null);
    setComparisonError("");
    setError("");
    setFilter("all");
    setQuery("");
    if (!id) {
      setAnalysis(null);
      setReportLoading(false);
      setComparisonLoading(false);
      return;
    }
    setAnalysis(known ?? null);
    setReportLoading(!known);
    try {
      const result =
        known ??
        (await readResponse<Analysis>(
          await fetch(`/api/analyses/${encodeURIComponent(id)}`),
        ));
      if (sequence !== requestSequence.current) return;
      setAnalysis(result);
      setReportLoading(false);
      setComparisonLoading(true);
      try {
        const prior = await readResponse<Analysis | null>(
          await fetch(`/api/analyses/${encodeURIComponent(id)}/previous`),
        );
        if (sequence === requestSequence.current) setPrevious(prior);
      } catch (cause) {
        if (sequence === requestSequence.current) {
          setComparisonError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a comparação.",
          );
        }
      } finally {
        if (sequence === requestSequence.current) setComparisonLoading(false);
      }
    } catch (cause) {
      if (sequence === requestSequence.current) {
        setReportLoading(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o relatório.",
        );
      }
    }
  }

  useEffect(() => {
    void loadHistory();
    void loadReport(reportIdFromUrl());
    const onPopState = () => {
      void loadReport(reportIdFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      requestSequence.current++;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function openReport(id: string | null) {
    setReportUrl(id);
    void loadReport(id);
  }

  const counts = useMemo(() => {
    const values = Object.fromEntries(
      impacts.map((item) => [item.id, 0]),
    ) as Record<Impact, number>;
    for (const issue of analysis?.issues ?? []) {
      if (issue.impact in values) values[issue.impact as Impact] += 1;
    }
    return values;
  }, [analysis]);

  const visibleIssues = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("pt-BR");
    return (analysis?.issues ?? []).filter(
      (issue) =>
        (filter === "all" || issue.impact === filter) &&
        (!text ||
          [
            issue.title,
            issue.ruleId,
            issue.selector,
            issue.category,
            categoryLabel(issue.category),
          ].some((value) => value.toLocaleLowerCase("pt-BR").includes(text))),
    );
  }, [analysis, filter, query]);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await readResponse<Analysis>(response);
      setReportUrl(body.id);
      void loadReport(body.id, body);
      void loadHistory();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível analisar a página.",
      );
    } finally {
      setLoading(false);
    }
  }

  const uniqueRules = analysis
    ? new Set(analysis.issues.map((issue) => issue.ruleId)).size
    : 0;
  const comparison =
    analysis && previous
      ? compareIssues(analysis.issues, previous.issues)
      : null;

  return (
    <div className="app-frame">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            C<span>A</span>
          </span>
          <span>ClearAccess</span>
        </a>
        <span className="topbar-context">Análise de acessibilidade</span>
      </header>

      <main className="sheet">
        <div className="content">
          <section className="intro" aria-labelledby="page-title">
            <div className="intro-copy">
              <h1 id="page-title">Analise uma página</h1>
              <p>
                Encontre problemas de acessibilidade e veja onde corrigi-los.
              </p>
            </div>
            <form className="url-form" onSubmit={analyze}>
              <label htmlFor="page-url">URL pública</label>
              <div className="url-controls">
                <input
                  id="page-url"
                  type="url"
                  placeholder="https://exemplo.com"
                  autoComplete="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                  aria-describedby="url-help"
                  disabled={loading}
                />
                <button type="submit" disabled={loading}>
                  {loading ? "Analisando…" : "Analisar página"}
                </button>
              </div>
              <p id="url-help" className="form-help">
                A análise pode levar até um minuto. Use uma página pública com
                HTTP ou HTTPS.
              </p>
              <p className="demo-help">
                Quer experimentar?{" "}
                <button
                  type="button"
                  className="inline-action"
                  onClick={() => setUrl(demoUrl())}
                >
                  Usar página de demonstração
                </button>
                <span aria-hidden="true"> · </span>
                <a
                  href="/demo/fixed.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver versão corrigida
                </a>
                {window.location.port === "5173" && (
                  <span className="demo-local-note">
                    No ambiente local, ative CLEARACCESS_DEMO=1 na API.
                  </span>
                )}
              </p>
            </form>
            {(loading || reportLoading) && (
              <p className="status-message" role="status">
                {loading
                  ? "Abrindo a página e verificando seus elementos…"
                  : "Carregando relatório salvo…"}
              </p>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </section>

          {analysis ? (
            <section className="report" aria-labelledby="report-title">
              <div className="report-heading">
                <div>
                  <h2 id="report-title">
                    {analysis.title || "Resultado da análise"}
                  </h2>
                  <p className="report-source">
                    <a
                      href={analysis.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {analysis.url}
                    </a>
                    <span aria-hidden="true"> · </span>
                    <time dateTime={analysis.analyzedAt}>
                      {formatDate(analysis.analyzedAt)}
                    </time>
                  </p>
                </div>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => openReport(null)}
                >
                  Novo relatório
                </button>
              </div>

              <div className="summary" aria-label="Resumo da análise">
                <div>
                  <span>Ocorrências</span>
                  <strong>{analysis.issues.length}</strong>
                </div>
                <div>
                  <span>Regras com problemas</span>
                  <strong>{uniqueRules}</strong>
                </div>
                <div>
                  <span>Revisão manual</span>
                  <strong>{analysis.needsManualReview}</strong>
                </div>
                <div>
                  <span>Verificações aprovadas</span>
                  <strong>{analysis.checkedRules}</strong>
                </div>
              </div>

              <section
                className="comparison"
                aria-labelledby="comparison-title"
              >
                <div className="comparison-heading">
                  <div>
                    <h3 id="comparison-title">Desde a análise anterior</h3>
                    {previous && (
                      <p>Mesmo endereço · {formatDate(previous.analyzedAt)}</p>
                    )}
                  </div>
                  {previous && (
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => openReport(previous.id)}
                    >
                      Abrir anterior
                    </button>
                  )}
                </div>
                {comparisonLoading ? (
                  <p role="status">Carregando comparação…</p>
                ) : comparisonError ? (
                  <p role="alert">
                    {comparisonError}{" "}
                    <button
                      type="button"
                      className="inline-action"
                      onClick={() => void loadReport(analysis.id)}
                    >
                      Tentar novamente
                    </button>
                  </p>
                ) : comparison ? (
                  <div className="comparison-values">
                    <div>
                      <strong>{comparison.added.length}</strong>
                      <span>novas ocorrências</span>
                    </div>
                    <div>
                      <strong>{comparison.resolved}</strong>
                      <span>resolvidas</span>
                    </div>
                    <div>
                      <strong>{comparison.unchanged}</strong>
                      <span>persistentes</span>
                    </div>
                  </div>
                ) : (
                  <p>Esta é a primeira análise salva deste endereço.</p>
                )}
              </section>

              <div className="findings-heading">
                <div>
                  <h3>Problemas encontrados</h3>
                  <p>
                    Filtre por impacto ou busque uma regra, categoria ou
                    elemento.
                  </p>
                </div>
                <span className="result-count">
                  {visibleIssues.length} de {analysis.issues.length}
                </span>
              </div>

              <div className="filters">
                <div
                  className="impact-filters"
                  aria-label="Filtrar por impacto"
                >
                  <button
                    type="button"
                    className={filter === "all" ? "selected" : ""}
                    aria-pressed={filter === "all"}
                    onClick={() => setFilter("all")}
                  >
                    Todos <span>{analysis.issues.length}</span>
                  </button>
                  {impacts.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={filter === item.id ? "selected" : ""}
                      aria-pressed={filter === item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label} <span>{counts[item.id]}</span>
                    </button>
                  ))}
                </div>
                <label className="search-label">
                  <span className="sr-only">Buscar nos problemas</span>
                  <input
                    type="search"
                    placeholder="Buscar nos problemas"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>

              {visibleIssues.length ? (
                <div className="issue-list">
                  {visibleIssues.map((issue, index) => (
                    <details
                      className="issue"
                      key={`${issue.ruleId}-${issue.selector}-${index}`}
                    >
                      <summary>
                        <span className={`impact impact-${issue.impact}`}>
                          {impactLabel(issue.impact)}
                        </span>
                        <span className="issue-main">
                          <strong>{issue.title}</strong>
                          <span className="issue-selector">
                            {issue.selector || "Elemento não informado"}
                          </span>
                        </span>
                        <span className="issue-category">
                          {categoryLabel(issue.category)}
                        </span>
                        <span className="chevron" aria-hidden="true" />
                      </summary>
                      <div className="issue-detail">
                        <div>
                          <h4>Por que é um problema</h4>
                          <p>{issue.why || issue.description}</p>
                        </div>
                        <div>
                          <h4>Como corrigir</h4>
                          <p>
                            {issue.howToFix ||
                              "Consulte a documentação da regra para orientações."}
                          </p>
                        </div>
                        <div className="element-detail">
                          <h4>Elemento afetado</h4>
                          <code>{issue.element}</code>
                        </div>
                        <a
                          className="rule-link"
                          href={issue.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver regra {issue.ruleId}{" "}
                          <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  {analysis.issues.length === 0
                    ? "Nenhum problema automático foi encontrado nesta análise. Ainda é importante revisar a página manualmente."
                    : "Nenhum problema corresponde a este filtro."}
                </div>
              )}
              <p className="report-note">
                Resultados automáticos indicam pontos de atenção, mas não
                substituem uma avaliação manual.
              </p>
            </section>
          ) : (
            <section className="first-run" aria-labelledby="first-run-title">
              <div>
                <h2 id="first-run-title">O que você verá aqui</h2>
                <p>
                  Um relatório direto para localizar e corrigir problemas
                  encontrados na página.
                </p>
              </div>
              <dl className="first-run-list">
                <div>
                  <dt>Impacto</dt>
                  <dd>Quais ocorrências merecem atenção primeiro.</dd>
                </div>
                <div>
                  <dt>Elemento</dt>
                  <dd>Onde cada problema aparece no código da página.</dd>
                </div>
                <div>
                  <dt>Correção</dt>
                  <dd>Por que a regra falhou e como começar a resolvê-la.</dd>
                </div>
              </dl>
            </section>
          )}
          <section className="history" aria-labelledby="history-title">
            <div className="history-heading">
              <div>
                <h2 id="history-title">Histórico recente</h2>
                <p>Até 20 análises salvas, da mais recente à mais antiga.</p>
              </div>
              <button
                type="button"
                className="text-action"
                onClick={() => void loadHistory()}
                disabled={historyLoading}
              >
                Atualizar
              </button>
            </div>
            {historyLoading && history.length === 0 ? (
              <p role="status">Carregando histórico…</p>
            ) : historyError ? (
              <p role="alert">
                {historyError}{" "}
                <button
                  type="button"
                  className="inline-action"
                  onClick={() => void loadHistory()}
                >
                  Tentar novamente
                </button>
              </p>
            ) : history.length === 0 ? (
              <p className="history-empty">
                As análises concluídas aparecerão aqui.
              </p>
            ) : (
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        selectedId === item.id
                          ? "history-item selected"
                          : "history-item"
                      }
                      aria-current={selectedId === item.id ? "page" : undefined}
                      onClick={() => openReport(item.id)}
                    >
                      <span className="history-page">
                        <strong>{item.title || item.url}</strong>
                        <small>{item.url}</small>
                      </span>
                      <span className="history-meta">
                        <time dateTime={item.analyzedAt}>
                          {formatDate(item.analyzedAt)}
                        </time>
                        <span>
                          {item.issueCount}{" "}
                          {item.issueCount === 1 ? "ocorrência" : "ocorrências"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
