# Backend CRM

Esse projeto é um projeto independente com fins lucrativos, com o intuíto de caso aconteça algo, tenho como direito esse código.

Ele é um **sistema web** que pode ser integrado com vários sistemas ERP's como **IXCSOFT**, **SGP**, **HUBSOFT**, **RECEITANET**, etc...

Ele facilitará, e muito, através de uma UI e UX fácil e elegante para os operadores mexerem no que realmente precisam, como por exemplo, localizar cadastro, atualizar o cadastro, localizar e enviar boletos, visualizar os contratos e serviços do cliente, realizar desbloqueios e redução de velocidade, verificar a conexão do cliente, desconectar, limpar o MAC, visualizar histórico de conexão, abrir atendimentos e ordens de serviços e muito mais.

Estarei utilizando o TS, Fastify, Drizzle, Docker, Postgres, Bun, Zod e rotatividade de tabelas que mais irão crescer (atendimentos) por ano e seguirei um padrão de código limpo e sustentável para integrar mais módulos, services e rotas, a API GTW que é o backend desse código, também terá logs para visualização de erros.

Um ponto importante é, os atendentes possuem endpoints de **Webhooks**, então será possível monitorar os atendimentos, criar atendimentos através de triggers para o atendente, por exemplo, ao entrar uma ligação de uma empresa ou chegar um chat, é possível chamar o endpoint chamando os metodos e passar os dados que achar melhor etc...

Haverá também um chat interno com suporte a grupos e chats privados.

### Requirements
- NODE 24+
- TS 5.9.3+
- Bun v1.3.9+
- Docker
- Debian ou Ubuntu 
- Redis
- RabbitMQ
- PostgreSQL

É recomendado ter o seguinte hardware:
- 2CORES
- 4GB+ RAM
- 50GB+ PARA ARMAZENAMENTO

Isso garantirá uma boa persistencia dos dados, levando em consideração uma utilização de **1 milhão de atendimentos registrados por ANO,** aumente conforme julgue necessário, os logs possuem rotatividade e compressão e serão deletados automaticamente a cada 7 dias.

### Get started

Clone esse repositório

- Configure o .env no projeto
- Suba o container PostgreSQL
- Instale os pacotes com: `bun install`
- Gere o generate do drizzle: `bun run db:generate`
- Gere o schema inicial do postgres: `bun run db:migrate`

### Author
Rafael Rizzo Breschi - Dev full stack