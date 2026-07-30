import { safeFetch } from '../../utils/net/safe-url'

// Cliente da API webservice do IXCsoft (ERP de provedores de internet BR) — padrão público:
// POST {baseUrl}/webservice/v1/{tabela}, Basic base64(token), header "ixcsoft: listar" pra listagem
// com filtro (qtype/query/oper). Credencial já vem descriptografada (ver src/lib/crypto.ts) — nunca
// loga o token.
export type IxcCredentialInput = { baseUrl: string; token: string }

async function ixcRequest(credential: IxcCredentialInput, table: string, filters: Record<string, string>): Promise<unknown> {
    const url = `${credential.baseUrl.replace(/\/+$/, '')}/webservice/v1/${table}`
    const res = await safeFetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(credential.token, 'utf8').toString('base64')}`,
            ixcsoft: 'listar',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qtype: filters.qtype ?? '', query: filters.query ?? '', oper: filters.oper ?? '=', page: '1', rp: '20' }),
    })
    return res.json()
}

// Catálogo de ações do nó IXCsoft — cada action mapeia pra uma tabela do webservice e um campo de
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

export async function runIxcAction(credential: IxcCredentialInput, action: IxcAction, params: Record<string, string>): Promise<unknown> {
    const config = IXC_ACTIONS[action]
    return ixcRequest(credential, config.table, {
        qtype: params.qtype || config.defaultQtype,
        query: params.query ?? '',
        oper: params.oper ?? '=',
    })
}
