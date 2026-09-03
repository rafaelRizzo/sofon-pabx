// Parser de dump SQL do mysqldump (formato usado pelo backup do Issabel/FreePBX) - lê os
// `INSERT INTO \`tabela\` (...) VALUES (...), (...), ...;` de um arquivo .sql em texto puro,
// sem precisar de um servidor MySQL. Um dump pode ter mais de um INSERT pra mesma tabela (o
// mysqldump quebra em vários statements quando a tabela é grande), por isso varre o arquivo
// inteiro em vez de parar no primeiro match.

export type SqlValue = string | null

const readInsertBody = (sql: string, table: string): string[] => {
    const marker = `INSERT INTO \`${table}\``
    const bodies: string[] = []
    let searchFrom = 0

    while (true) {
        const start = sql.indexOf(marker, searchFrom)
        if (start === -1) break
        const valuesIdx = sql.indexOf('VALUES', start)
        if (valuesIdx === -1) break

        let i = valuesIdx + 'VALUES'.length
        while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t') i++

        const bodyStart = i
        let inString = false
        for (; i < sql.length; i++) {
            const c = sql[i]
            if (inString) {
                if (c === '\\') {
                    i++
                    continue
                }
                if (c === "'") inString = false
                continue
            }
            if (c === "'") {
                inString = true
                continue
            }
            if (c === ';') break
        }

        bodies.push(sql.slice(bodyStart, i))
        searchFrom = i + 1
    }

    return bodies
}

// Tokeniza "(a,b,'c'),(d,e,'f')" respeitando aspas simples e escapes (\' \\ etc) - cada tupla vira
// um array de campos; string 'NULL' literal (sem aspas) vira null, o resto sempre volta como string
// (conversão numérica fica por conta de quem consome, já que o schema de cada tabela é conhecido ali)
const parseTuples = (body: string): SqlValue[][] => {
    const tuples: SqlValue[][] = []
    let tuple: SqlValue[] = []
    let field = ''
    let inString = false
    let quoted = false
    // Fora de um par de parênteses (ex: a vírgula separando "(...),(...)") não há campo nenhum pra
    // empurrar - sem esse flag, essa vírgula de fora reaproveita o array já publicado em `tuples`
    // (referência ainda presa em `tuple` até o próximo '(') e sobra um campo vazio no fim da tupla
    let inTuple = false

    const pushField = () => {
        tuple.push(quoted ? field : field === 'NULL' ? null : field)
        field = ''
        quoted = false
    }

    for (let i = 0; i < body.length; i++) {
        const c = body[i]

        if (inString) {
            if (c === '\\') {
                const next = body[i + 1]
                const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0' }
                field += next !== undefined ? (map[next] ?? next) : ''
                i++
                continue
            }
            if (c === "'") {
                inString = false
                continue
            }
            field += c
            continue
        }

        if (c === "'") {
            inString = true
            quoted = true
            continue
        }
        if (c === '(') {
            inTuple = true
            tuple = []
            field = ''
            quoted = false
            continue
        }
        if (!inTuple) continue
        if (c === ',') {
            pushField()
            continue
        }
        if (c === ')') {
            pushField()
            tuples.push(tuple)
            inTuple = false
            continue
        }
        field += c
    }

    return tuples
}

/** Extrai todas as linhas inseridas numa tabela do dump, como arrays posicionais de campos. */
export const extractTableRows = (sql: string, table: string): SqlValue[][] => {
    const bodies = readInsertBody(sql, table)
    return bodies.flatMap(parseTuples)
}
