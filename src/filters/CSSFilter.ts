import * as express from "express"
import LRUBufferCache from "../LRUBufferCache"
import tools, { IResponseData } from "../tools"
import Filter, { IProcessedResponse } from "./Filter"

export default class CSSFilter extends Filter {

    public async onSourceResponseArrive(res: IResponseData, buffer: Buffer): Promise<IProcessedResponse> {
        var processedBuffer = Buffer.concat([
            new Buffer(4),
            Buffer.from(res.contentType, "utf-8"),
            Buffer.from("this is css file. \n", "utf-8"),
            buffer
        ]);
        processedBuffer.writeInt32BE(res.contentType.length, 0);
        return {
            contentType:res.contentType,
            content: processedBuffer.slice(4 + res.contentType.length),
            processedContent: processedBuffer
        }
    }

    public async onSourceResponseCacheWillBeSent(buffer: Buffer): Promise<IProcessedResponse> {
        var contentTypeLength: number = buffer.readInt32BE(0);
        return {
            content: buffer.slice(4 + contentTypeLength),
            contentType: buffer.slice(4, 4 + contentTypeLength).toString(),
        };
    }
}