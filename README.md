# ClearAccess

O ClearAccess analisa a acessibilidade de páginas públicas e apresenta os problemas encontrados por elemento e impacto.

## Estado atual

A interface React recebe a URL, mostra o andamento e apresenta o relatório com contagens, filtros por impacto, busca e detalhes de cada problema. Ela lista as 20 análises recentes, abre relatórios salvos por link e compara cada execução com a anterior do mesmo endereço. A API Spring Boot recebe a URL em `POST /api/analyses`. Um worker Node abre a página com Chromium, executa o axe-core e devolve os problemas encontrados. Cada análise bem-sucedida é salva no PostgreSQL. A análise é síncrona e tem limite de 60 segundos. O endpoint `GET /api/health` verifica se a API está ativa.

As regras do axe-core são apresentadas em português. A análise automatizada não substitui uma revisão manual de acessibilidade.

## Requisitos

- Java 21 e Maven 3.9+
- Node.js 20.19+ ou 22.12+
- Chromium instalado pelo Playwright
- PostgreSQL 16, disponível pelo Docker Compose

## Instalação

```bash
cd worker
npm install
npx playwright install chromium
npm test
```

Na raiz do projeto, inicie o banco:

```bash
docker compose up -d db
```

Em outro terminal, inicie a API a partir de `backend/`:

```bash
cd backend
mvn test
mvn spring-boot:run
```

Em um terceiro terminal, inicie a interface:

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`. O Vite encaminha as chamadas `/api` para a API local na porta 8080. Para verificar a versão de produção da interface, execute `npm run build` em `frontend/`.

Para analisar as páginas locais de demonstração, habilite `CLEARACCESS_DEMO=1` no ambiente da API antes de iniciá-la. No PowerShell, por exemplo:

```powershell
cd backend
$env:CLEARACCESS_DEMO = "1"
mvn spring-boot:run
```

Na interface, use **Usar página de demonstração** para preencher a URL com `http://localhost:5173/demo/broken.html`. A versão corrigida está em `/demo/fixed.html`. A primeira contém problemas intencionais de nome de botão, contraste, idioma e texto alternativo; a segunda não contém essas falhas. A exceção para `localhost:5173` é exclusiva deste modo de desenvolvimento e não deve ser habilitada em uma implantação pública.

O caminho do worker é relativo ao diretório de execução da API. Caso inicie a API de outro diretório, configure `clearaccess.worker.script` com o caminho absoluto de `worker/analyze.mjs`. A conexão padrão usa `localhost:5433`, usuário e senha `clearaccess`. Para outro banco, configure `DATABASE_URL`, `DATABASE_USER` e `DATABASE_PASSWORD`. O Flyway aplica a migração ao iniciar a API; o volume `clearaccess_data` preserva os dados entre reinícios do container.

## Usar a API

```bash
curl -X POST http://localhost:8080/api/analyses -H "Content-Type: application/json" -d '{"url":"https://example.com/"}'
```

Uma análise bem-sucedida recebe HTTP 201, cabeçalho `Location` e corpo com `id`, `url`, `title`, `issues`, `needsManualReview`, `checkedRules` e `analyzedAt`. Cada item em `issues` inclui regra, impacto, categoria, seletor, elemento, motivo e orientação de correção. Uma URL inválida ou interna recebe HTTP 400; falhas na página ou no navegador recebem HTTP 502; tempo esgotado recebe HTTP 504.

```bash
curl http://localhost:8080/api/analyses
curl http://localhost:8080/api/analyses/SEU-ID-AQUI
curl http://localhost:8080/api/analyses/SEU-ID-AQUI/previous
```

A lista retorna até 20 resumos, do mais recente ao mais antigo. A consulta por ID devolve o relatório completo ou HTTP 404. O endpoint `/previous` devolve o relatório anterior da mesma URL final, HTTP 204 quando não existe anterior e HTTP 404 para um ID inexistente. Na interface, `?analysis=SEU-ID-AQUI` abre um relatório salvo diretamente. A comparação considera a combinação de regra e seletor de cada ocorrência; mudanças nessa combinação aparecem como ocorrência resolvida e nova.

## Testes

```bash
cd backend && mvn test
cd ../worker && npm test
cd ../frontend && npm test && npm run build
```

Para os testes de ponta a ponta, mantenha `npm run dev` ativo em `frontend/` e execute `npm run test:e2e` em `worker/`. Esses testes usam Chromium: verificam as duas páginas de demonstração com o worker real e testam histórico, comparação, navegação e acessibilidade da interface com respostas de API simuladas.

O worker bloqueia destinos locais e endereços reservados, inclusive em redirecionamentos e recursos da página. Para expor esta API publicamente, o navegador também deve ser isolado em uma rede sem acesso a serviços internos; a verificação de DNS da aplicação, por si só, não protege contra mudanças de DNS entre a validação e a conexão.

## Próximos incrementos

1. Preparação de uma implantação com isolamento de rede para o navegador.
2. Paginação e busca no histórico para além das 20 análises recentes.
3. Comparação detalhada das ocorrências resolvidas e novas, com exportação do relatório.

A primeira versão não depende de IA ou de ferramentas pagas.
