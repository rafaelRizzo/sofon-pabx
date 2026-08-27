# Runbook: AGI (varcond/fila/transfer) parava de funcionar em silêncio

> TL;DR: eram 4 bugs empilhados, não 1. Os 2 primeiros (código) só ficaram visíveis
> depois de resolver os 2 últimos (infra). Se esse sintoma voltar, pule direto pra
> "Como diagnosticar de novo" no fim - é mais rápido que reler tudo.

## Sintoma original

Nó **Validar variável** (condição CPF/CNPJ) num Flow sempre caía no branch errado
(ou simplesmente desligava a ligação), mesmo com regras/rotas configuradas certas
no dashboard. Log do Asterisk mostrava:

```
WARNING[...]: ast_expr2.fl:468 ast_yyerror: syntax error, unexpected '='...
```

Depois de resolver isso, o sintoma mudou pra: o `AGI()` conecta, o Asterisk manda o
ambiente inteiro (`agi_channel`, `agi_callerid` etc.), mas **nenhum comando é
trocado depois disso** - direto pra `Hangup()` na próxima priority, como se o
script não tivesse feito nada.

## Causa raiz #1 (código) - checksum de CPF/CNPJ gerava `$[...]` inválido

`VariableCondition.rules[].operator = cpf/cnpj` era validado montando uma expressão
Asterisk (`$[...]`) que fatiava a variável em offsets fixos: `${VAR:9:1}`,
`${VAR:12:1}` etc.

Quando o valor digitado tinha tamanho **diferente** do esperado (o caso mais
comum - é literalmente o que o operador serve pra pegar), a fatia ficava
**vazia antes mesmo do `$[...]` avaliar**, virando algo como:

```
( = (((...)*10)%11)%10))
```

Isso é erro de **sintaxe** pro `ast_expr2` do Asterisk, não "falso" - loga warning
toda vez que alguém erra o CPF, que é o caso normal de uso.

Bônus do mesmo bug: qualquer operador que interpola o valor **real** da variável
(`eq`/`contains`/`regex`/`filled`, não só cpf/cnpj) tinha risco parecido se esse
valor tivesse aspas - `CALLERID(name)`/CNAM é controlado por quem liga, não por
quem configura o fluxo.

### Fix

Movida toda a avaliação de `VariableCondition` pra dentro do AGI server, em **JS
puro** - sem string de expressão pra escapar. O dialplan gerado virou só
`AGI(...)` + `Hangup()` (mesmo padrão de RequestTemplate/IxcNode), a lógica real
(`evaluateRule`/`evaluateRules`/`validChecksum`) roda em `handleVariableCondition`
(`agi-server.ts`).

De brinde, ganhou suporte a **CNPJ alfanumérico** (IN RFB 2.229/2024) de graça, já
que em JS a conversão char→código (`charCodeAt(0)-48`) é trivial. CPF continua
100% numérico (nunca ganhou esse formato).

- Arquivos: `backend/src/asterisk/destinations/variablecondition.repository.ts`,
  `backend/src/asterisk/transport/agi-server.ts`
- Commit: `f2a7324`

## Causa raiz #2 (código) - `EXEC Goto` via AGI não é confiável

Mesmo depois do fix #1, o AGI conectava, processava a regra certinho (log
`agi.variable_condition.done` aparecia com `matched` correto), mas **o canal nunca
saía do contexto original** - a chamada só caía direto pra `Hangup()`.

`agiExecGoto()` usava `EXEC Goto ctx,ext,pri` - isto é, rodar a **aplicação**
`Goto` por dentro do próprio AGI. É um workaround comum em tutoriais, mas tem
histórico de comportamento inconsistente entre versões/timing do Asterisk (não é
o mecanismo nativo do protocolo pra isso).

### Fix

Trocado por `SET CONTEXT` / `SET EXTENSION` / `SET PRIORITY` - os comandos
**nativos** do protocolo AGI, feitos exatamente pra dizer "quando eu terminar,
continue daqui". O Asterisk aplica sozinho ao fim do script.

Esse fix beneficia todos os handlers que usam `agiExecGoto` (RequestTemplate,
IxcNode, TransferRoute, VariableCondition), não só o de variável.

- Arquivo: `backend/src/asterisk/transport/agi-server.ts` (função `agiExecGoto`)
- Commit: `19fae31`

## Causa raiz #3 (infra) - `docker-proxy` apontando pro IP errado

Mesmo com os dois fixes de código, a ligação real continuava travando **antes de
qualquer comando ser trocado** - nem o primeiro `GET VARIABLE` chegava a sair. Com
`agi set debug on` no Asterisk (log completo de cada comando AGI), a ligação real
nunca mostrava nem um `AGI Rx <<`.

### Como isso foi isolado

- Teste sintético direto no processo (`docker exec` + socket TCP simulando o
  Asterisk) provou que **o código funciona perfeitamente** quando a conexão chega
  até ele.
- 6h de log do worker sem **nenhum** evento AGI de sucesso (nem fila, nem
  transfer, nem request-template) - não era específico da condição de variável.
- `docker-proxy` (processo do Docker no host que faz a ponte `127.0.0.1:4573` →
  container) estava configurado apontando pra um IP (`172.18.0.x`) que **não
  pertencia a nenhum container em uso** - o worker real estava em outro range
  (`10.0.1.x`).

### Por quê

`dokploy-network` é rede **overlay** (Swarm), não bridge normal:

```bash
docker network inspect dokploy-network --format 'Driver={{.Driver}} Scope={{.Scope}}'
# Driver=overlay Scope=swarm
```

Publicar porta de host (`ports: - 127.0.0.1:X:Y`) de um **container avulso** (não
um Swarm *service* de verdade) numa rede overlay não é bem sustentado pelo
Docker - o `docker-proxy` falha em resolver o IP real do container nela.
Confirmado que **restart do container, restart completo do Docker daemon e
recriação não resolviam** - é estrutural, não cache velho.

### Fix

Criada uma segunda rede, **bridge normal** (`sofon-agi-bridge`), dedicada só a
publicar essa porta. O worker continua na `dokploy-network` pra falar com
postgres/redis (isso nunca teve esse problema - tráfego container-a-container via
DNS interno não passa pelo `docker-proxy`).

```bash
docker network create --driver bridge sofon-agi-bridge
```

```yaml
# backend/docker-compose.yml, serviço backend-worker
networks:
  dokploy-network: {}
  sofon-agi-bridge: {}

networks:
  dokploy-network:
    external: true
  sofon-agi-bridge:
    external: true
```

> A rede precisa existir na VPS **antes** do deploy (`docker network create`
> acima) - não é criada automaticamente pelo compose porque é `external: true`.

- Commit: `9fc561c`

## Causa raiz #4 (código) - processo só escutava em loopback interno

Mesmo com o `docker-proxy` apontando pro IP certo (confirmado: `172.21.0.2`
batendo com o IP real do worker na rede nova), a ligação ainda falhava - conexão
direta do host pro IP do container dava `Connection refused`.

### Por quê

`AGI_HOST` era usado pra **duas coisas diferentes** com o mesmo valor:

1. Montar a URL `agi://127.0.0.1:4573/...` que o Asterisk disca (correto ser
   `127.0.0.1`, é o host)
2. O endereço que o processo **escuta** dentro do container
   (`Bun.listen({hostname: env.AGI_HOST, ...})`)

Dentro de um container, `127.0.0.1` é o **loopback interno dele** - não a
interface de rede que recebe tráfego encaminhado pelo `docker-proxy`. Um processo
escutando só em `127.0.0.1` recusa qualquer conexão que chegue via bridge/rede.

### Fix

Separada a variável de bind (`AGI_LISTEN_HOST`, default `0.0.0.0` - todas as
interfaces) da variável de URL (`AGI_HOST`, continua `127.0.0.1`).

```ts
// backend/src/config/env.ts
AGI_HOST: z.string().default('127.0.0.1'),       // o que o Asterisk disca
AGI_LISTEN_HOST: z.string().default('0.0.0.0'),  // onde o processo escuta
```

```ts
// backend/src/server.ts
startAgiServer(env.AGI_LISTEN_HOST, env.AGI_PORT) // antes: env.AGI_HOST
```

- Commit: `9fc561c` (mesmo commit do fix #3, foram resolvidos juntos)

## Checklist de deploy (pra tudo funcionar de verdade)

1. Código com os 4 fixes deployado (`f2a7324`, `19fae31`, `9fc561c` ou posterior)
2. Rede `sofon-agi-bridge` criada na VPS:
   `docker network create --driver bridge sofon-agi-bridge`
3. `backend-worker` recriado (não só reiniciado):
   `docker compose up -d --no-deps --force-recreate backend-worker`

> **Pendência conhecida**: dialplan de empresas/recursos que não foram tocados
> desde os fixes continuam com o formato antigo (`GotoIf` em vez de `AGI` puro,
> ou host antigo) até alguém editar/salvar de novo, ou até rodar
> `bun run src/scripts/backfill-dialplan-files.ts` no VPS pra regerar tudo de
> uma vez.

## Como diagnosticar de novo (se AGI voltar a falhar em silêncio)

Nessa ordem, do mais rápido pro mais lento:

1. **O comando chega no processo?**
   `docker exec sofon_backend_worker printenv AGI_LISTEN_HOST` - se voltar
   `127.0.0.1` em vez de `0.0.0.0`, o deploy não pegou o fix #4.

2. **O proxy da porta aponta pro IP certo?**

   ```bash
   ss -tlnp | grep 4573   # pega o PID
   ps -p <PID> -o cmd --no-headers   # mostra -container-ip
   docker inspect sofon_backend_worker \
     --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
   # os dois IPs têm que bater
   ```

3. **Teste sintético sem telefonia** - simula o Asterisk direto via socket, sem
   precisar ligar de verdade:

   ```js
   // dentro do container: docker exec sofon_backend_worker bun /tmp/probe.js
   const net = require('net')
   const sock = net.createConnection(4573, '127.0.0.1', () => {
     sock.write(['agi_network_script: varcond', 'agi_arg_1: <id-real>', '', ''].join('\n'))
   })
   sock.on('data', (c) => console.log('RX:', c.toString()))
   ```

   Se isso funciona mas a ligação real não, o bug é de rede/proxy, não de código.

4. **`agi set debug on`** no CLI do Asterisk antes de testar - mostra cada
   comando `GET VARIABLE`/`SET CONTEXT` trocado. Se não aparecer nenhum depois do
   envio do ambiente, o processo nunca recebeu a conexão de verdade.

5. **Logs estruturados do handler** (`agi.variable_condition.rule`, `.done`,
   `.goto`, `.no_route`, `.session.error`) - mostram por regra o que foi lido e
   por que bateu/não bateu.
