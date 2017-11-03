import * as express from "express"
import LRUBufferCache from "../LRUBufferCache"
import tools, { IResponseData } from "../tools"
import Filter, { IProcessedResponse } from "./Filter"

interface IRegexpMatchsStruct {
    start: number,
    end: number,
    url: string,
    new_url: string,
}

interface IRedirectResult {
    host: string,
    path: string,
    uri: string,
}


export default class CSSFilter extends Filter {

    public async onSourceResponseArrive(res: IResponseData, buffer: Buffer): Promise<IProcessedResponse> {

        var regexp = new RegExp(/url\(\"{0,1}(.*?)\"{0,1}\)/g);
        var match: RegExpExecArray, matches: Array<IRegexpMatchsStruct> = [];

        while ((match = regexp.exec(buffer.toString())) != null) {
            let IRedirectResult = this.redirectStaticFile(match[1]);
            if(IRedirectResult == null) continue;
            matches.push({
                start: match.index,
                end: regexp.lastIndex,
                url: match[1],
                new_url: this.formathIRedirectResult(IRedirectResult)
            });
        }

        var renderBuffer = null;

        for(let i = 0; i < matches.length; i++) {
            if(i == 0) {
                renderBuffer = buffer.slice(0, matches[0].start);
            } else {
                renderBuffer = Buffer.concat([renderBuffer, buffer.slice(matches[i - 1].end, matches[i].start)]);
            }
            renderBuffer = Buffer.concat([renderBuffer, Buffer.from(`url("${matches[i].new_url}")`, "utf-8")]);
            if(i + 1 == matches.length) {
                renderBuffer = Buffer.concat([renderBuffer, buffer.slice(matches[i].end)]);
            }
        }

        var processedBuffer = Buffer.concat([
            new Buffer(4),
            Buffer.from(res.contentType, "utf-8"),
            Buffer.from("this is css file. \n", "utf-8"),
            renderBuffer == null ? buffer : renderBuffer
        ]);

        processedBuffer.writeInt32BE(res.contentType.length, 0);
        return {
            contentType: res.contentType,
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

    private formathIRedirectResult(i: IRedirectResult): string {
        var newHost: string = this.filterConfig["redirect_domain"] || "";
        return `${newHost}${i.host}/${i.path}/${i.uri}`;
    }

    /* From https://github.com/Srar/ngx-static-files-redirect-filter/blob/master/ngx_static_files_redirect_tag_tools.c#L35 */
    private redirectStaticFile(tag_url: string): IRedirectResult {
        var host = this.sourceHost;
        var path = this.sourceRequestPath;
        var is_front_http: boolean = false;
        var is_front_https: boolean = false;
        is_front_http = this.checkFrontProtocol("http://", tag_url);
        if (!is_front_http) is_front_https = this.checkFrontProtocol("https://", tag_url);

        let result: IRedirectResult = {
            host: new Buffer(host).toString("base64"),
            path: new Buffer(path).toString("base64"),
            uri: "",
        }

        if (is_front_http == false && is_front_https == false) {
            if (tag_url[0] != '/') {
                /* <img src="public/imgs/header.jpg"> */
                if (tag_url[0] != '.' && tag_url[1] != '/') {
                    result.uri = new Buffer(path.substring(0, path.lastIndexOf("/") + 1) + tag_url).toString("base64");
                    return result;
                }

                /* <img src="./public/imgs/header.jpg"> */
                if (tag_url[0] == '.' && tag_url[1] == '/') {
                    result.uri = new Buffer(path.substring(0, path.lastIndexOf("/") + 1) + tag_url.substring(2)).toString("base64");
                    return result;
                }
            }

            /* skip <script src="//cdn.staticfile.org/jquery/2.2.1/jquery.min.js"></script>  */
            if (tag_url[0] == '/' && tag_url[1] == '/') {
                return null;
            }

            /* <img src="/public/imgs/header.jpg"> */
            if (tag_url[0] == '/') {
                result.uri = new Buffer(tag_url).toString("base64");
                return result;
            }
        }

        if (is_front_http || is_front_https) {
            let limit_flags: number[] = [0, 0, 0];
            for (let i = 0; i < tag_url.length; i++) {
                if (tag_url[i] != '/') continue;
                if (limit_flags[0] == 0) {
                    limit_flags[0] = i;
                    continue;
                }
                if (limit_flags[1] == 0) {
                    limit_flags[1] = i;
                    continue;
                }
                if (limit_flags[2] == 0) {
                    limit_flags[2] = i;
                    break;
                }
            }
  
            let tag_url_domain: string = tag_url.substring(limit_flags[1] + 1, limit_flags[2]);
            if (tag_url_domain != host) return null;

            result.uri = new Buffer(tag_url.substring(limit_flags[2])).toString("base64");
            return result;
        }

        return null;
    }

    private checkFrontProtocol(protocol: string, target: string): boolean {
        for (let i = protocol.length - 1; i > 0; i--) {
            if (protocol[i] !== target[i]) return false;
        }
        return true;
    } 
}