import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { compareIssues } from "./compare";
import { comparisonCsv, downloadReport, issuesCsv } from "./export";

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

type AnalysisPage = { items: AnalysisSummary[]; page: number; size: number; total: number };

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
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const historySequence = useRef(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [previous, setPrevious] = useState<Analysis | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [timeline, setTimeline] = useState<AnalysisSummary[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const requestSequence = useRef(0);
  const [filter, setFilter] = useState<Impact | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory(page = historyPage, search = historySearch) {
    const sequence = ++historySequence.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams({ page: String(page), q: search });
      const result = await readResponse<AnalysisPage>(await fetch(`/api/analyses/history?${params}`));
      if (sequence !== historySequence.current) return;
      setHistory(result.items);
      setHistoryTotal(result.total);
    } catch (cause) {
      if (sequence !== historySequence.current) return;
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o histórico.",
      );
    } finally {
      if (sequence === historySequence.current) setHistoryLoading(false);
    }
  }

  async function loadReport(id: string | null, known?: Analysis) {
    const sequence = ++requestSequence.current;
    setSelectedId(id);
    setPrevious(null);
    setComparisonError("");
    setTimeline([]);
    setTimelineError("");
    setTimelineLoading(false);
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
      setTimelineLoading(true);
      void fetch(`/api/analyses/${encodeURIComponent(id)}/timeline`)
      .then(readResponse<AnalysisSummary[]>).then((items) => {
        if (sequence === requestSequence.current) setTimeline(items);
      }).catch((cause) => {
        if (sequence === requestSequence.current) setTimelineError(
          cause instanceof Error ? cause.message : "Não foi possível carregar a evolução.",
        );
      }).finally(() => {
        if (sequence === requestSequence.current) setTimelineLoading(false);
      });
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHistorySearch(historyQuery.trim());
      setHistoryPage(0);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [historyQuery]);

  useEffect(() => {
    void loadHistory(historyPage, historySearch);
  }, [historyPage, historySearch]);

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
      setHistoryPage(0);
      void loadHistory(0, historySearch);
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
  const timelineMax = Math.max(1, ...timeline.map((item) => item.issueCount));

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

              <div className="report-actions" aria-label="Exportar relatório">
                <button type="button" className="text-action" onClick={() =>
                  downloadReport(JSON.stringify(analysis, null, 2), `clearaccess-${analysis.id}.json`, "application/json")
                }>Baixar JSON</button>
                <button type="button" className="text-action" onClick={() =>
                  downloadReport(issuesCsv(analysis.issues), `clearaccess-${analysis.id}.csv`, "text/csv;charset=utf-8")
                }>Baixar CSV</button>
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

              <section className="timeline" aria-labelledby="timeline-title">
                <div className="timeline-heading">
                  <h3 id="timeline-title">Evolução das ocorrências</h3>
                  <p>Até dez análises deste endereço, incluindo a atual.</p>
                </div>
                {timelineLoading ? <p role="status">Carregando evolução…</p>
                  : timelineError ? <p role="alert">{timelineError}</p>
                  : timeline.length > 0 ? (
                    <ol className="timeline-list">
                      {timeline.map((item) => (
                        <li key={item.id}>
                          <button type="button" onClick={() => openReport(item.id)}
                            aria-current={item.id === analysis.id ? "page" : undefined}>
                            <time dateTime={item.analyzedAt}>{formatDate(item.analyzedAt)}</time>
                            <span className="timeline-track" aria-hidden="true"><span style={{
                              width: `${item.issueCount / timelineMax * 100}%`,
                            }} /></span>
                            <strong>{item.issueCount}</strong>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : <p>Nenhuma evolução disponível.</p>}
              </section>

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
                    <div className="comparison-actions">
                    {comparison && <button type="button" className="text-action"
                      onClick={() => downloadReport(
                        comparisonCsv(comparison.added, comparison.resolvedIssues),
                        `clearaccess-comparacao-${analysis.id}.csv`, "text/csv;charset=utf-8",
                      )}>Baixar comparação</button>}
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => openReport(previous.id)}
                    >
                      Abrir anterior
                    </button>
                    </div>
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
                  <><div className="comparison-values">
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
                  {(comparison.added.length > 0 || comparison.resolvedIssues.length > 0) && (
                    <div className="comparison-details">
                      {([
                        ["Novas ocorrências", comparison.added],
                        ["Ocorrências resolvidas", comparison.resolvedIssues],
                      ] as const).map(([label, issues]) => issues.length > 0 && (
                        <div key={label}>
                          <h4>{label}</h4>
                          <ul>{issues.map((issue, index) => <li key={`${issue.ruleId}-${issue.selector}-${index}`}>
                            <strong>{issue.title}</strong> <span>{issue.selector || issue.ruleId}</span>
                          </li>)}</ul>
                        </div>
                      ))}
                    </div>
                  )}</>
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
                <h2 id="history-title">Histórico de análises</h2>
                <p>Busque análises salvas pelo título ou endereço.</p>
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
            <label className="history-search">
              <span>Buscar no histórico</span>
              <input type="search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Título ou URL" maxLength={200} />
            </label>
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
                {historySearch
                  ? "Nenhuma análise corresponde à busca."
                  : "As análises concluídas aparecerão aqui."}
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
            {!historyError && historyTotal > 0 && (
              <nav className="history-pagination" aria-label="Páginas do histórico">
                <button type="button" disabled={historyLoading || historyPage === 0}
                  onClick={() => setHistoryPage(historyPage - 1)}>Anterior</button>
                <span>Página {historyPage + 1} de {Math.ceil(historyTotal / 20)} · {historyTotal} análises</span>
                <button type="button" disabled={historyLoading || (historyPage + 1) * 20 >= historyTotal}
                  onClick={() => setHistoryPage(historyPage + 1)}>Próxima</button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
