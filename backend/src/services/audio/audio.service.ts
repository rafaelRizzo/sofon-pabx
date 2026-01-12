import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/handler.error'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import ffmpegPath from 'ffmpeg-static'

const execPromise = promisify(exec)

export const audioSelect = {
    id: true,
    name: true,
    companyId: true,
    filename: true,
    createdAt: true,
    updatedAt: true,
}

export class AudioService {
    private readonly AUDIO_BASE_PATH = path.join(process.cwd(), 'uploads', 'audios')

    private async ensureCompanyDirectory(companyId: string): Promise<string> {
        const companyPath = path.join(this.AUDIO_BASE_PATH, companyId)

        try {
            await fs.access(companyPath)
        } catch {
            await fs.mkdir(companyPath, { recursive: true })
        }

        return companyPath
    }

    private async saveAudioFile(companyId: string, filename: string, fileBuffer: Buffer): Promise<string> {
        const companyPath = await this.ensureCompanyDirectory(companyId)
        const filePath = path.join(companyPath, filename)

        await fs.writeFile(filePath, fileBuffer)

        return filePath
    }

    private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
        try {
            // Usa o caminho do ffmpeg-static
            const ffmpeg = ffmpegPath || 'ffmpeg'

            // Comando ffmpeg otimizado para Asterisk
            const command = `"${ffmpeg}" -y -i "${inputPath}" -ar 8000 -ac 1 -c:a pcm_s16le "${outputPath}"`

            console.log('Executando comando:', command)

            const { stdout, stderr } = await execPromise(command)

            if (stderr && !stderr.includes('time=')) {
                console.log('FFmpeg output:', stderr)
            }
        } catch (error: any) {
            console.error('Erro completo:', error)
            throw new Error(`Erro ao converter áudio: ${error.message}`)
        }
    }

    private async deleteAudioFile(companyId: string, filename: string): Promise<void> {
        try {
            const filePath = path.join(this.AUDIO_BASE_PATH, companyId, filename)
            await fs.unlink(filePath)
        } catch (error) {
            console.error('Erro ao deletar arquivo:', error)
        }
    }

    async create(request: any) {
        // Pega o arquivo e os campos do multipart
        const data = await request.file()

        if (!data) {
            throw new AppError('Nenhum arquivo foi enviado', 400)
        }

        const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/x-wav']
        if (!allowedMimeTypes.includes(data.mimetype)) {
            throw new AppError('Tipo de arquivo não suportado. Apenas MP3, WAV e OGG são permitidos', 400)
        }

        const name = data.fields.name?.value as string
        const companyId = data.fields.companyId?.value as string

        if (!name || !companyId) {
            throw new AppError('Nome e companyId são obrigatórios', 400)
        }

        // Verifica se empresa existe
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        })

        if (!company) {
            throw new AppError('Empresa não encontrada', 404)
        }

        // Verifica duplicação
        const existingAudio = await prisma.audio.findUnique({
            where: {
                companyId_name: {
                    companyId,
                    name
                }
            }
        })

        if (existingAudio) {
            throw new AppError('Já existe um áudio com esse nome nesta empresa', 409)
        }

        const timestamp = Date.now()
        const tempFilename = `${timestamp}${path.extname(data.filename)}`
        const finalFilename = `${timestamp}.wav` // Sempre salva como WAV

        // Converte arquivo para buffer e salva temporariamente
        const fileBuffer = await data.toBuffer()
        const tempPath = await this.saveAudioFile(companyId, tempFilename, fileBuffer)
        const finalPath = path.join(path.dirname(tempPath), finalFilename)

        try {
            // Converte para WAV formato Asterisk
            await this.convertToWav(tempPath, finalPath)

            // Deleta arquivo temporário original
            await fs.unlink(tempPath)
        } catch (error) {
            // Se falhar a conversão, deleta arquivo temporário e lança erro
            await fs.unlink(tempPath).catch(() => { })
            throw new AppError('Erro ao converter arquivo para formato compatível com Asterisk', 500)
        }

        // Cria registro no banco
        return await prisma.audio.create({
            data: {
                name,
                companyId,
                filename: finalFilename
            },
            select: audioSelect
        })
    }

    async list(companyId?: string) {
        const where = companyId ? { companyId } : {}

        return await prisma.audio.findMany({
            where,
            select: audioSelect,
            orderBy: { name: 'asc' }
        })
    }

    async getById(id: string) {
        const audio = await prisma.audio.findUnique({
            where: { id },
            select: {
                ...audioSelect,
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })

        if (!audio) {
            throw new AppError('Áudio não encontrado', 404)
        }

        return audio
    }

    async delete(id: string) {
        const audio = await prisma.audio.findUnique({
            where: { id }
        })

        if (!audio) {
            throw new AppError('Áudio não encontrado', 404)
        }

        if (audio.filename) {
            await this.deleteAudioFile(audio.companyId, audio.filename)
        }

        await prisma.audio.delete({
            where: { id }
        })

        return { success: true, message: 'Áudio deletado com sucesso' }
    }

    async getAudioFilePath(id: string): Promise<string> {
        const audio = await prisma.audio.findUnique({
            where: { id },
            select: {
                companyId: true,
                filename: true
            }
        })

        if (!audio || !audio.filename) {
            throw new AppError('Áudio não encontrado', 404)
        }

        return path.join(this.AUDIO_BASE_PATH, audio.companyId, audio.filename)
    }
}