import * as net from "net"
import * as request from "request"

export default {

    requestBuffer(url: string, bufferMaximum: number): Promise<IResponseData> {
        var returnData: IResponseData = {
            statusCode: -1,
            contentType: "",
            content: null
        };
        var bufsSize: number = 0;
        var bufsChain: Array<Buffer> = [];
        var responseConnection: net.Socket = null;
        return new Promise((resolve, reject) => {
            var response: request.Request = request.get(url, { timeout: 15 * 1000 });
            response.on("response", function (response) {
                returnData.statusCode = response.statusCode;
                returnData.contentType = <string>response.headers["content-type"];
                responseConnection = response.connection;
            })
            response.on("data", function (data) {
                bufsSize += data.length;
                if (bufsSize > bufferMaximum) {
                    response.emit("error", new Error("超出Buffer大小限制."));
                    return;
                }
                bufsChain.push(<Buffer>data);
            })
            response.on("end", () => {
                returnData.content = Buffer.concat(bufsChain, bufsSize);
                resolve(returnData);
            });
            response.on("error", function (err) {
                response.removeAllListeners();
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