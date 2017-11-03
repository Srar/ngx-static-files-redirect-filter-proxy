import * as express from "express"
import LRUBufferCache from "../LRUBufferCache"
import tools, { IResponseData } from "../tools"

export default abstract class Filter {

    constructor (
        protected cacheKey: string,
        protected sourceHost: string,
        protected sourceRequestPath: string,
        protected sourceUri: string,
        protected request: express.Request,
        protected filterConfig: any
    ) {
      
    }
    
    abstract onSourceResponseArrive(res: IResponseData, buffer: Buffer): Promise<IProcessedResponse>;
    abstract onSourceResponseCacheWillBeSent(buffer: Buffer): Promise<IProcessedResponse>;
}

export interface IProcessedResponse {
    content: Buffer,
    contentType:string,
    processedContent?: Buffer,
}