# ClearAccess

O ClearAccess é um projeto de portfólio para analisar a acessibilidade de páginas públicas e apresentar os problemas encontrados de forma clara e acionável.

## Objetivo

A primeira versão permitirá informar uma URL, acompanhar a análise, consultar problemas por impacto e elemento, ver análises anteriores e comparar resultados da mesma página. Também haverá uma página de demonstração com problemas conhecidos e uma versão corrigida.

## Tecnologias planejadas

- Frontend: React e TypeScript
- Backend: Java 21 e Spring Boot
- Banco de dados: PostgreSQL, com migrações versionadas
- Análise automatizada: axe-core em um navegador controlado

## Estado atual

O projeto está na fase inicial de organização. As pastas `frontend/` e `backend/` contêm apenas arquivos vazios para registrar a estrutura no Git. A aplicação ainda não está implementada nem pronta para execução.

## Estrutura

```text
ClearAccess/
├── backend/
│   └── App.java
├── frontend/
│   └── index.html
└── README.md
```

O desenvolvimento será feito em etapas. A primeira versão não dependerá de serviços de IA ou ferramentas pagas.
