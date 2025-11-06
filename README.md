# Challenge2025-Ache
Challenge2025 FIAP X Aché - AGvision

# Introdução
Problema: Consolidar, acompanhar e gerir tarefas de múltiplos projetos, antigos e novos, 

Solução: API Flask que normaliza os projetos inseridos, entregando dados prontos e completos ao frontend, possibilitando adições e alterações no próprio arquivo Excel.

# Arquitetura

<img width="207" height="420" alt="image" src="https://github.com/user-attachments/assets/26071d90-fe1d-45b8-a4d2-a5d4e32b8444" />

# Desenvolvimento
O desenvolvimento enfrentou desafios práticos típicos de integração entre planilhas Excel e uma aplicação web: heterogeneidade de colunas e formatos, células com hiperlinks, regras distintas para marcar tarefas como concluídas e variações de “duração”. Para resolver, padronizamos o esquema no backend (mapeando nomes canônicos e validando tipos), implementamos um parser robusto para porcentagens e duração, e unificamos o sinal de conclusão. Também tratamos anexos separando descrição de URL, garantindo que o frontend mostrasse o texto no modal e abrisse o link correto. Por fim, lidamos com I/O de planilhas de forma segura — evitando duplicidade de números por aba e prevenindo conflitos de gravação — e adicionamos logs claros para depuração.

As etapas seguiram um fluxo incremental: 1) modelagem dos dados e normalização no Flask; 2) montagem do painel de supervisão e do gestor em HTML/JS; 3) persistência confiável no Excel (auditável) ao concluir/reabrir; 4) testes de desempenho e ajustes de payload/caching leve; 5) melhorias de UX responsiva e tratamento de estados; 6) Implementação do chatbot responsivo integrado com o banco de dados. Com isso, garantimos um ciclo completo: leitura consistente das planilhas, visualização amigável, ações idempotentes no backend e feedback imediato no frontend, além da possibilidade do uso do chatbot.

#Resultados
Os resultados consolidam um fluxo estável de ponta a ponta: leitura e normalização confiáveis das planilhas com prevenção de duplicidades, regra unificada de conclusão, e persistência auditável ao concluir/reabrir tarefas; no frontend, o painel de supervisão ganhou métricas claras, gráficos e drilldown filtrável, enquanto a pagina de gestão exibe cards por prazo, filtros por fase/prioridade e um modal de anexos que separa corretamente texto auxiliar de link clicável; o sistema mostra ganho de usabilidade (carregamento rápido em bases médias, ordenação/busca úteis, layout responsivo), resiliência de dados (validações brandas, backups) e clareza operacional (logs e mensagens de feedback), reduzindo tempo de triagem e erro humano e permitindo decisões ágeis sobre tarefas críticas e atrasadas.

# UI's:

## Gestor de tarefas (página responsável pela conclusão)
<img width="1851" height="993" alt="image" src="https://github.com/user-attachments/assets/2af57768-9223-4be0-9072-36a68d1081d5" />
legenda: Imagem 1 mostra o visual da pagina de gestão

<img width="1848" height="997" alt="image" src="https://github.com/user-attachments/assets/b6aa5a67-f018-4fbd-b0ca-9eca50cf2472" />
legenda: Imagem 2 mostra o sistema de filtros e pesquisa da pagina de gestão

<img width="1836" height="992" alt="image" src="https://github.com/user-attachments/assets/7358cd64-26a9-41e8-b54b-03136d615105" />
legenda: Imagem 3 modal de anexos


## Supervisor (página resposável pela análise, aprovação e criação das tarefas e projetos)
<img width="1836" height="918" alt="image" src="https://github.com/user-attachments/assets/8c22312c-bb64-42c6-878b-8545c2e9ccbd" />
lengenda: Imagem 1/3 visual da pagina

<img width="1832" height="920" alt="image" src="https://github.com/user-attachments/assets/cd3954eb-668b-44dd-b429-c43d41b90be0" />
legenda:  Imagem 2/3 visual da pagina (adicionar tarefa)

<img width="1830" height="924" alt="image" src="https://github.com/user-attachments/assets/e62d05ce-43da-4565-a83c-86357bca0179" />
legenda: Imagem 3/3 visual da pagina (adicionar projeto)

<img width="1830" height="912" alt="image" src="https://github.com/user-attachments/assets/d46ca4ca-08ec-4922-b5a3-d86157d8b263" />
legenda: Drilldown 1/4 (todas as tarefas)

<img width="1829" height="915" alt="image" src="https://github.com/user-attachments/assets/3bb9b447-4116-459d-b8b2-b78e91868630" />
legenda: Drilldown 2/4 (tarefas concluídas)

<img width="1831" height="921" alt="image" src="https://github.com/user-attachments/assets/b387fb1f-7d64-4e78-b74d-a6dba29d2cb1" />
legenda: Drilldown 3/4 (tarefas críticas)

<img width="1829" height="915" alt="image" src="https://github.com/user-attachments/assets/65ac414d-f2ff-4374-8125-364cb9dfdf06" />
legenda: Drilldown 4/4 (tarefas próximas do prazo)

## Chatbot
<img width="1844" height="989" alt="image" src="https://github.com/user-attachments/assets/b811ddc9-7b70-4509-9337-9d3bc85f90a8" />
legenda: Visual pagina do chatbot (sem conversas)

<img width="1842" height="986" alt="image" src="https://github.com/user-attachments/assets/625c4204-b9ac-41a7-8d6b-8c969bac2bad" />
legenda: Visual pagina do chatbot (com conversas + linha de raciocínio)
