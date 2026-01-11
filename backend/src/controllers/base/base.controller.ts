import { type FastifyReply, type FastifyRequest } from 'fastify'

export abstract class BaseController {
    protected request: any
    protected reply: FastifyReply

    constructor(
        request: any,
        reply: FastifyReply
    ) {
        this.request = request
        this.reply = reply
    }
}
