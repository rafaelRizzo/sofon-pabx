import { safeFetch } from '../../utils/net/safe-url'

// Cliente da API webservice do IXCsoft (ERP de provedores de internet BR) - padrão público:
// POST {baseUrl}/webservice/v1/{tabela}, Basic base64(token), header "ixcsoft: listar" pra listagem
// com filtro (qtype/query/oper). Credencial já vem descriptografada (ver src/lib/crypto.ts) - nunca
// loga o token.
export type IxcCredentialInput = { baseUrl: string; token: string }

// Retorna a requisição/resposta crua inteira (não só o JSON parseado) - o AGI server precisa do
// url/payload/status pra logar via VERBOSE no console do Asterisk (debug em tempo real da
// integração), e `ok` pra decidir a rota onSuccess/onError corretamente (IXC pode responder 200
// com corpo de erro, mas também responde 4xx/5xx puro - antes disso não era checado, tratando
// qualquer resposta sem exceção como sucesso).
export type IxcRequestResult = {
    url: string
    payload: Record<string, string>
    status: number
    ok: boolean
    rawBody: string
    data: unknown
}

async function ixcRequest(credential: IxcCredentialInput, table: string, filters: Record<string, string>, signal?: AbortSignal): Promise<IxcRequestResult> {
    const url = `${credential.baseUrl.replace(/\/+$/, '')}/webservice/v1/${table}`
    const payload = { qtype: filters.qtype ?? '', query: filters.query ?? '', oper: filters.oper ?? '=', page: '1', rp: '20' }
    const res = await safeFetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(credential.token, 'utf8').toString('base64')}`,
            ixcsoft: 'listar',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
    })
    const rawBody = await res.text()
    let data: unknown = null
    try { data = JSON.parse(rawBody) } catch { data = null }
    return { url, payload, status: res.status, ok: res.ok, rawBody, data }
}

// Catálogo de ações do nó IXCsoft - cada action mapeia pra uma tabela do webservice e um campo de
// busca padrão. Campos exatos de qtype/tabela são o de-para público, a confirmar/ajustar contra o
// token real do usuário (ver plano aprovado).
export const IXC_ACTIONS = {
    listar_cliente: {
        label: 'Listar cliente',
        table: 'cliente',
        defaultQtype: 'cliente.cnpj_cpf',
    },
    listar_boleto: {
        label: 'Listar boleto',
        table: 'fn_areceber',
        defaultQtype: 'fn_areceber.id_cliente',
    },
} as const

export type IxcAction = keyof typeof IXC_ACTIONS

export async function runIxcAction(credential: IxcCredentialInput, action: IxcAction, params: Record<string, string>, signal?: AbortSignal): Promise<IxcRequestResult> {
    const config = IXC_ACTIONS[action]
    return ixcRequest(credential, config.table, {
        qtype: params.qtype || config.defaultQtype,
        query: params.query ?? '',
        oper: params.oper ?? '=',
    }, signal)
}
