import * as twebp from "twebp"
import * as express from "express"
import LRUBufferCache from "../LRUBufferCache"
import tools, { IResponseData } from "../tools"
import Filter, { IProcessedResponse } from "./Filter"

import { WebPEncodeOptions } from "twebp"

const HEADER_SIZE: number = 8;

function N_WebPEncodeAsyncPromise(buf: Buffer, options: WebPEncodeOptions): Promise<Buffer> {
    return new Promise(function (resolve, reject) {
        twebp.N_WebPEncodeAsync(buf, options, function (err, webp) {
            if (err) return reject(err);
            resolve(webp);
        });
    });
}

export default class ImageFilter extends Filter {

    /*
        +--------------------------------------+
        |      Image Cache Buffer Struct       |
        +--------------------------------------+
        | Content Type Length(4 bit)           |
        | Source Response Buffer Length(4 bit) |
        | Content Type Buffer                  |
        | WebP Buffer                          |
        | Source Buffer                        |
        +--------------------------------------+
    */


    public async onSourceResponseArrive(res: IResponseData, buffer: Buffer): Promise<IProcessedResponse> {

        var webpBuffer: Buffer = await N_WebPEncodeAsyncPromise(buffer, {
            quality: 80,
            thread_level: 1,
        })

        var isSupportWebP: boolean = this.isClientSupportWebP();

        var processedBuffer = Buffer.concat([
            new Buffer(HEADER_SIZE),
            Buffer.from(res.contentType, "utf-8"),
            webpBuffer,
            buffer
        ]);

        processedBuffer.writeInt32BE(res.contentType.length, 0);
        processedBuffer.writeInt32BE(webpBuffer.length, 4);

        var content: Buffer = null;
        var contentType: string = "";

        if (isSupportWebP) {
            content = webpBuffer;
            contentType = "image/webp";
        } else {
            content = buffer;
            contentType = res.contentType;
        }

        return {
            content: content,
            contentType: contentType,
            processedContent: processedBuffer
        }

    }

    public async onSourceResponseCacheWillBeSent(buffer: Buffer): Promise<IProcessedResponse> {
        var isSupportWebP: boolean = this.isClientSupportWebP();

        var contentTypeLength: number = buffer.readInt32BE(0);
        var webpBufferLength: number = buffer.readInt32BE(4);

        var content: Buffer = null;
        var contentType: string = "";

        if (isSupportWebP) {
            content = buffer.slice(HEADER_SIZE + contentTypeLength, HEADER_SIZE + contentTypeLength + webpBufferLength);
            contentType = "image/webp";
        } else {
            content = buffer.slice(HEADER_SIZE + contentTypeLength + webpBufferLength);
            contentType = buffer.slice(HEADER_SIZE, HEADER_SIZE + contentTypeLength).toString();
        }

        return {
            content: content,
            contentType: contentType,
        }
    }

    private isClientSupportWebP(): boolean {
        return (this.request.headers["accept"] != undefined && this.request.headers["accept"].indexOf("webp") != -1);
    }

}