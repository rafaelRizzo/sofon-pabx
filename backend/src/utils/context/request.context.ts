import { AsyncLocalStorage } from 'node:async_hooks'

interface RequestContext {
    reqId: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export const getReqId = () => requestContext.getStore()?.reqId
