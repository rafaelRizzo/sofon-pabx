import { getReqId } from '../context/request.context'

export class AppError extends Error {
    public readonly reqId?: string

    constructor(
        public override readonly message: string,
        public readonly statusCode: number = 400
    ) {
        super(message)
        this.name = 'AppError'
        this.reqId = getReqId()
    }
}
