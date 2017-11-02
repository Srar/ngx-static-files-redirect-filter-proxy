import * as net from "net"
import * as zlib from "zlib"
import * as request from "request"

export default {

    compress(buffer: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            zlib.deflate(buffer, (err, buffer) => {
                err ? reject(err) : resolve(buffer);
            });
        });
    },

    uncompress(buffer: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            zlib.unzip(buffer, (err, buffer) => {
                err ? reject(err) : resolve(buffer);
            });
        });
    },

    requestBuffer(url: string, bufferMaximum: number): Promise<IResponseData> {
        var returnData: IResponseData = {
            statusCode: -1,
            contentType: "",
            content: null
        };
        var contentSize: number = 0;
        var responseConnection: net.Socket = null;
        return new Promise((resolve, reject) => {
            var response: request.Request = request.get(url);
            response.on("response", function (response) {
                returnData.statusCode = response.statusCode;
                returnData.contentType = <string>response.headers["content-type"];
                responseConnection = response.connection;
            })
            response.on("data", function (data) {
                contentSize += data.length;
                if (contentSize > bufferMaximum) {
                    response.emit("error", new Error("超出Buffer大小限制."));
                    return;
                }
                if (returnData.content == null) return returnData.content = <Buffer>data;
                returnData.content = Buffer.concat([returnData.content, <Buffer>data]);
            })
            response.on("end", () => resolve(returnData));
            response.on("error", function(err) {
                response.removeAllListeners();
                responseConnection.end();
                reject(err);
            });
        });
    }
}

export interface IResponseData {
    statusCode: number,
    contentType: string,
    content: Buffer
}