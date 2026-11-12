# ClearAccess

O ClearAccess analisa a acessibilidade de páginas públicas e apresenta os problemas encontrados por elemento e impacto.

## Estado atual

A API Spring Boot recebe uma URL em `POST /api/analyses`. Um worker Node abre a página com Chromium, executa o axe-core e devolve os problemas encontrados. A análise é síncrona e tem limite de 60 segundos. O endpoint `GET /api/health` verifica se a API está ativa.

Ainda não há interface, histórico ou banco conectado. A análise automatizada não substitui uma revisão manual de acessibilidade.

## Requisitos

- Java 21 e Maven 3.9+
- Node.js 20+
- Chromium instalado pelo Playwright

## Instalação

```bash
cd worker
npm install
npx playwright install chromium
npm test
```

Em outro terminal, inicie a API a partir de `backend/`:

```bash
cd backend
mvn test
mvn spring-boot:run
```

O caminho do worker é relativo ao diretório de execução da API. Caso inicie a API de outro diretório, configure `clearaccess.worker.script` com o caminho absoluto de `worker/analyze.mjs`.

## Usar a API

```bash
curl -X POST http://localhost:8080/api/analyses -H "Content-Type: application/json" -d '{"url":"https://example.com/"}'
```

A resposta contém `url`, `title`, `issues`, `needsManualReview`, `checkedRules` e `analyzedAt`. Cada item em `issues` inclui regra, impacto, categoria, seletor, elemento, motivo e orientação de correção. Uma URL inválida ou interna recebe HTTP 400; falhas na página ou no navegador recebem HTTP 502; tempo esgotado recebe HTTP 504.

O worker bloqueia destinos locais e endereços reservados, inclusive em redirecionamentos e recursos da página. Para expor esta API publicamente, o navegador também deve ser isolado em uma rede sem acesso a serviços internos; a verificação de DNS da aplicação, por si só, não protege contra mudanças de DNS entre a validação e a conexão.

## Próximos incrementos

1. Interface React e TypeScript para enviar uma URL e consultar os resultados.
2. Persistência das análises no PostgreSQL com migrações versionadas.
3. Histórico, comparação e páginas de demonstração.

O `compose.yaml` já contém a configuração inicial do PostgreSQL, mas o banco ainda não é usado. A primeira versão não depende de IA ou de ferramentas pagas.
