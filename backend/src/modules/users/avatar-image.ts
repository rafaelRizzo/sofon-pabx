import sharp, { type Metadata } from 'sharp'
import { AppError } from '../../utils/errors/app.error'

const MAX_DIMENSION = 4096
const OUTPUT_SIZE = 512

// Extensão/mimetype do multipart vêm do cliente e são forjáveis (mesmo aviso de audios.controller.ts):
// quem decide se o upload é uma foto de verdade é o sharp decodificando os bytes reais via libvips
// e reportando o formato verdadeiro do conteúdo - um .gif renomeado pra .png cai aqui como
// format:"gif" e é rejeitado, independente do que o nome/Content-Type alegam.
//
// Reencodar a partir dos pixels decodificados (em vez de só validar e salvar o buffer original)
// descarta qualquer coisa embutida no arquivo original - EXIF, comentário de texto, payload
// anexado após o fim da imagem (polyglot) - o arquivo final no disco nunca contém nenhum byte
// do upload recebido.
export async function processAvatarImage(buffer: Buffer): Promise<Buffer> {
    let metadata: Metadata
    try {
        metadata = await sharp(buffer).metadata()
    } catch {
        throw new AppError('Arquivo de imagem corrompido ou inválido', 422)
    }

    if (metadata.format !== 'jpeg' && metadata.format !== 'png') {
        throw new AppError('Apenas imagens PNG ou JPEG são aceitas', 422)
    }
    if (!metadata.width || !metadata.height) {
        throw new AppError('Arquivo de imagem corrompido ou inválido', 422)
    }
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
        throw new AppError('Imagem excede as dimensões máximas permitidas', 422)
    }

    try {
        return await sharp(buffer)
            .rotate() // normaliza orientação a partir do EXIF antes de descartá-lo
            .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' })
            .webp({ quality: 85 })
            .toBuffer()
    } catch {
        throw new AppError('Falha ao processar a imagem', 422)
    }
}
