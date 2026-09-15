# Runbook: 2 trunks PJSIP da mesma operadora/IP roteiam pro DID errado

> TL;DR: quando 2 trunks outbound da MESMA empresa compartilham `host` (operadora
> multi-conta atrás de um SBC único), a identificação de endpoint do Asterisk
> (`ps_identifies`, por IP) é ambígua e **não-determinística** entre eles -
> `${TRUNKID}` (setvar do endpoint) pode vir do trunk errado mesmo a chamada tendo
> entrado certa. `from-trunk` roteia por `${CHANNEL(accountcode)}` (= `Company.asteriskId`,
> idêntico nos 2 endpoints ambíguos) em vez de `${TRUNKID}` - a ambiguidade deixa
> de importar porque não afeta mais qual InboundRoute é encontrada.

## Sintoma

Cliente com 2 números (DIDs) na mesma operadora, cada um seu próprio trunk
outbound (username/password diferentes), mesmo `host`. Ligando pros dois:

- Só 1 dos 2 números completa a chamada por vez - o outro cai em "destino inválido"
  (`Hangup` em `from-trunk-routed`, exten `i`, log "DID sem rota").
- Às vezes **os dois** param de funcionar ao mesmo tempo.
- `pjsip show identifies` mostra 2 objetos com o mesmo `Match` (mesmo IP) -
  qual dos 2 "ganha" para uma chamada dada não é aleatório dentro de uma mesma
  instância do Asterisk (parece seguir ordem alfabética do `id` do endpoint -
  confirmado empiricamente renomeando um trunk e vendo o vencedor trocar), mas
  **não é um comportamento documentado nem estável entre reload/restart/versão**.

## Causa raiz

1. Tronco outbound cria `ps_identifies.match = host` (`PjsipRepository.createTrunk`).
   Dois trunks da mesma operadora com o mesmo `host` geram 2 linhas com `match`
   idêntico, `endpoint` diferente.
2. `res_pjsip_endpoint_identifier_ip` (via Realtime/ODBC) resolve o endpoint de
   uma chamada entrante **antes** do dialplan. Com 2 candidatos empatados por
   `match`, ele escolhe só 1 - de forma consistente numa mesma instância, mas
   sem garantia nenhuma de qual.
3. `[from-trunk]` (dialplan estático, `base-dialplan.repository.ts`) roteava por
   `Goto(from-trunk-routed,${EXTEN}_${TRUNKID},1)`, onde `TRUNKID` é o `setvar`
   do endpoint **resolvido no passo 2**. Se o endpoint errado ganhou, `TRUNKID`
   vem errado, e o exten `<did>_<trunkId>` correto (gravado por
   `InboundRouteRepository` na criação da Inbound Route) nunca é encontrado -
   cai no catch-all `i` → "DID sem rota" → `Hangup`.
4. **Tentativa que não funcionou**: usar `ps_identifies.match_header` (regex no
   header `To`, ex: `To: (5511999999999)`) pra desambiguar por número discado em
   vez de IP. Não funcionou porque `match_header` é um filtro **adicional** sobre
   `match`, nunca um substituto: a lookup Realtime busca candidatos por IP
   primeiro (`WHERE match casa com a origem`) e só then testaria `match_header`
   nos candidatos retornados - só que na prática, com os 2 candidatos empatados
   por IP, o Asterisk resolveu só 1 deles (o mesmo de sempre) SEM sequer chegar a
   testar o header dos dois. Zerar `match` e deixar só `match_header` também não
   funciona: sem `match`, a linha fica invisível pra essa lookup por IP e
   **nenhum** endpoint é identificado (regressão pior - visto em produção, as 2
   trunks pararam de funcionar ao mesmo tempo).

## Fix

Duas mudanças, uma por camada:

**1. `PjsipRepository.syncIdentify`** (`src/asterisk/endpoints/pjsip.repository.ts`)
mantém `match` (por host) sempre, e adiciona `match_header` por cima quando a
trunk tem DID(s) vinculado(s) - documentação honesta do limite: isso ajuda em
alguns casos, mas **não resolve** o cenário de 2 trunks da mesma empresa
competindo pelo mesmo IP (ver item 4 acima). Mantido porque não piora nada e
ajuda a distinguir trunks de **empresas diferentes** no mesmo IP (aí sim
`accountcode` seria diferente e o fix da camada 2 não ajudaria sozinho).

**2. Chave de roteamento por empresa, não por trunk** (fix de verdade) -
`inboundroute.repository.ts` grava o exten de `from-trunk-routed` como
`<did>_<companyAsteriskId>` em vez de `<did>_<trunkId>`, e `[from-trunk]`
(`base-dialplan.repository.ts` + `setups/install-asterisk.sh`) roteia por
`Goto(from-trunk-routed,${EXTEN}_${CHANNEL(accountcode)},1)`.
`CHANNEL(accountcode)` é o `accountcode` do endpoint (`= Company.asteriskId`,
setado em **todo** endpoint/friend na criação da trunk) - quando os 2 endpoints
ambíguos são da MESMA empresa (o caso real, operadora multi-conta), o
`accountcode` é **idêntico** nos dois. A ambiguidade do passo 2 (qual endpoint
"ganhou") deixa de importar pro roteamento: não importa qual dos 2 o Asterisk
escolheu, o `accountcode` bate do mesmo jeito.

`CDR(trunk_id)` / `ROUTING_TRUNK_ID` / `GROUP()` (limite de canais por trunk)
continuam corretos e **não** dependem dessa mudança - são gravados literais no
dialplan a partir do `trunkId` real da própria `InboundRoute` no momento do
`create`/`update`, nunca do `TRUNKID` resolvido em tempo de chamada.

**Efeito colateral aceito**: 1 DID só pode estar em 1 Inbound Route agora
(bloqueado em `createInboundRoute`, 409) - antes o schema permitia (sem uso
real) o mesmo DID em 2 trunks diferentes, o que colidiria na nova chave
(mesmo `<did>_<companyAsteriskId>` pros dois).

**Migração de dado existente**: `InboundRouteRepository.regenerateAll(companyId)`
agora roda no `backfill-dialplan-files.ts` (boot, junto com os outros
`regenerate()`) - reescreve toda Inbound Route existente com a chave nova. As
linhas antigas (`<did>_<trunkId>`) ficam órfãs na tabela `extensions` (inertes,
nunca mais referenciadas por `[from-trunk]`) - `pruneOrphans()` não as limpa
porque hoje escopa por sufixo `_<companyAsteriskId>`, não por trunk; limpeza
manual opcional via SQL se incomodar (`DELETE FROM extensions WHERE context =
'from-trunk-routed' AND exten ~ '_c[a-z0-9]{20,}$'` - sufixo de cuid, não de
asteriskId curto).

## Como diagnosticar de novo

1. `asterisk -rx "pjsip show identifies"` - 2+ linhas com o mesmo `Match` (IP) é
   o sinal - trunks concorrendo pelo mesmo endpoint.
2. `asterisk -rx "pjsip set logger on"` + ligação de teste - ver qual `Channel
   'PJSIP/<endpoint>-...'` foi de fato usado pro `Goto` vs. qual `TRUNKID`
   deveria ter sido.
3. Confirmar `[from-trunk]` em produção usa `CHANNEL(accountcode)`, não
   `TRUNKID`: `ssh` na VPS, `grep -A1 "Goto(from-trunk-routed" /etc/asterisk/sofon-managed.conf`.
4. Se uma trunk nova de outra empresa aparecer competindo pelo mesmo IP de uma
   trunk já existente (cenário não coberto pelo fix - `accountcode` diferente
   entre elas), esse é um caso novo, não este bug - normalmente resolvido pedindo
   IP/porta dedicado à operadora, já que aí nem `accountcode` nem `match_header`
   ajudam sozinhos.
