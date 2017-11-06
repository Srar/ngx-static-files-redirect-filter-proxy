///<reference path="../node_modules/@types/node/index.d.ts"/>
///<reference path="../node_modules/@types/morgan/index.d.ts"/>
///<reference path="../node_modules/@types/request/index.d.ts"/>
///<reference path="../node_modules/@types/express/index.d.ts"/>
///<reference path="../node_modules/@types/body-parser/index.d.ts"/>

import * as fs from "fs"
import * as zlib from "zlib"
import * as morgan from "morgan"
import * as request from "request"
import * as express from "express"
import * as bodyParser from "body-parser"
import LRUBufferCache from "./LRUBufferCache"

import config from "./config"
import tools, { IResponseData } from "./tools"

import CSSFilter from "./filters/CSSFilter"
// import ImageFilter from "./filters/ImageFilter"
import DefaultFilter from "./filters/DefaultFilter"
import Filter, { IProcessedResponse } from "./filters/Filter"

const app: express.Application = express();
const router: express.Router = express.Router();
const config: config = JSON.parse(fs.readFileSync("./config.json").toString());
const bufferCache: LRUBufferCache = new LRUBufferCache(config.cache_space_limit * 1024 * 1024);

if(config.accept_unauthorized_cert) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var allowHosts: { [host: string]: boolean } = {};
for (var host of config.allow_hosts)
    allowHosts[host.host] = host.https;

var processingList: { [fullUrl: string]: number } = {};

const filtersRouter = {
    "css": CSSFilter,
    // "jpg": ImageFilter,
    // "png": ImageFilter,
    // "gif": ImageFilter,
    // "jpeg": ImageFilter,
}

app.set("trust proxy", true);
app.use(morgan("dev"))
// app.use(morgan("common"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.get("/status", function (req: express.Request, res: express.Response) {
    res.send(`
        <html lang="en">
        <head><title>Caches Status</title></head>
        <body>
            <p>total: ${config.cache_space_limit}MB</p>
            <p>used: ${(bufferCache.getCacheUsedSpace() / 1024 / 1024).toFixed(2)}MB</p>
            <p>free: ${(config.cache_space_limit - bufferCache.getCacheUsedSpace() / 1024 / 1024).toFixed(2)}MB</p>
            <p>elements count: ${bufferCache.getCacheElementsCount()}</p>
            <a href="/flush">flush caches</a>
        </body>
        </html>
    `);
});

router.all("/flush", function (req: express.Request, res: express.Response) {
    var message: string = "";
    if (req.method == "POST") {
        message = (function () {
            let url: string = req.body["url"] || "";
            if (url == "") return "invalid url";
            let regexp = new RegExp(/(http:\/\/|https:\/\/)(.*?\/)(.*?\/)(.*?\/)(.*)/);
            let match = regexp.exec(url);
            if (match == null || match[3] == undefined || match[5] == undefined) return "invalid url";
            let host = new Buffer(match[3].substring(0, match[3].length - 1), "base64").toString();
            let uri = new Buffer(match[5], "base64").toString();
            let cacheKey: string = host + uri;
            let cache: Buffer = bufferCache.get(cacheKey);
            if (cache == null) {
                return "the resource has not been cache.";
            }
            bufferCache.remove(cacheKey);
            return "the resource was been flush.";
        })();
    }
    res.send(`
        <html lang="en">
        <head><title>Caches Flush</title></head>
        <body>
            <p>${message}</p>
            <form method="post" action="/flush" >
                <input style="width: 200px;" type="text" name="url" />&nbsp;&nbsp;<button type="submit">flush</button>
            </form>
            <a href="/status">view caches status</a>
        </body>
        </html>
    `);
});

router.get("/", async function (req: express.Request, res: express.Response) {
    var fullUrlArray: Array<string> = (req.query["url"] || "").split(":");
    if(fullUrlArray.length != 3) {
        return res.status(403).send("invalid url.");
    }

    var host: string = fullUrlArray[0];
    var path: string = fullUrlArray[1];
    var uri: string = fullUrlArray[2];

    uri = new Buffer(uri, "base64").toString();
    host = new Buffer(host, "base64").toString();
    path = new Buffer(path, "base64").toString();

    if (allowHosts[host] == undefined) return res.status(403).send("not allowed host.");

    var cacheKey: string = host + uri;
    var cacheFilter: Filter = (function () {
        var ext: string = uri.substring(uri.lastIndexOf(".") + 1);
        /* example.com/123.css?a=1 */
        if (ext.indexOf("?") != -1) ext = ext.substring(0, ext.indexOf("?"));

        var filter = filtersRouter[ext];
        if (filter == null) filter = DefaultFilter

        return new filter(cacheKey, host, path, uri, req, config);
    })();

    var cache: Buffer = bufferCache.get(cacheKey);
    var sourceUrl: string = (allowHosts[host] ? "https://" : "http://") + host
    if (host[host.length - 1] != "/" && uri[0] != "/") sourceUrl += "/";
    sourceUrl += uri;

    var processedCache: IProcessedResponse = null;

    res.header({ "Access-Control-Allow-Origin": "*" });

    if (cache != null) {
        try {
            processedCache = await cacheFilter.onSourceResponseCacheWillBeSent(cache);
        } catch (error) {
            res.status(503).send(`filter error.`);
            console.error(error);
            return;
        }
        res.status(200)
            .contentType(processedCache.contentType)
            .header({ "static-files-cache": "hit" })
            .send(processedCache.content);
        return;
    }

    if (cache == null && processingList[cacheKey] == undefined) {
        processingList[cacheKey] = 1;
        let response: IResponseData = null;
        try {
            response = await tools.requestBuffer(sourceUrl, 1024 * 1024 * config.single_cache_limit);
            if (response.statusCode == 200) {
                processedCache = await cacheFilter.onSourceResponseArrive(response, response.content);
            }
        } catch (error) {
            res.status(503).send(`remote server or Filter error.`);
            console.error(error);
            delete processingList[cacheKey];
            return;
        }

        if (response.statusCode == 200) {
            res.status(response.statusCode)
                .contentType(processedCache.contentType)
                .header({ "static-files-cache": "miss" })
                .send(processedCache.content);
            bufferCache.put(cacheKey, processedCache.processedContent);
        } else {
            res.status(response.statusCode).contentType(response.contentType).send(response.content);
        }

        delete processingList[cacheKey];
        return;
    }

    res.header({ "static-files-cache": "source" });
    request(sourceUrl).pipe(res);

    var stream = request(sourceUrl);
    stream.on("error", (err) => {});
    stream.pipe(res);
});

app.use('/', router);

app.listen(config.service_port, function () {
    console.log("http service listen port at", config.service_port);
});