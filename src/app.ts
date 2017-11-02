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
import tools , { IResponseData } from "./tools"

import CSSFilter                    from "./filters/CSSFilter"
import DefaultFilter                from "./filters/DefaultFilter"
import Filter, {IProcessedResponse} from "./filters/Filter"

const app: express.Application = express();
const router: express.Router = express.Router();
const config: config = JSON.parse(fs.readFileSync("./config.json").toString());
const bufferCache: LRUBufferCache = new LRUBufferCache(config.cache_space_limit * 1024 * 1024);

var allowHosts: { [host: string]: number } = {};
for (var host of config.allow_hosts) allowHosts[host] = 1;

var processingList: { [fullUrl: string]: number } = {};

const filtersRouter = {
    "css": CSSFilter,
}

app.set("trust proxy", true);
app.use(morgan("dev"))
// app.use(morgan("common"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.get("/status", function (req: express.Request, res: express.Response) {
    res.send(`
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Cache Status</title>
        </head>
        <body>
            <p>total: ${config.cache_space_limit}MB</p>
            <p>used: ${(bufferCache.getCacheUsedSpace() / 1024 / 1024).toFixed(2)}MB</p>
            <p>free: ${(config.cache_space_limit - bufferCache.getCacheUsedSpace() / 1024 / 1024).toFixed(2)}MB</p>
            <p>elements count: ${bufferCache.getCacheElementsCount()}</p>
        </body>
        </html>
    `);
});

router.get("/:host/:uri", async function (req: express.Request, res: express.Response) {
    var uri: string = req.params["uri"];
    var host: string = req.params["host"];

    uri = new Buffer(uri, "base64").toString();
    host = new Buffer(host, "base64").toString();
    
    if (allowHosts[host] == undefined) return res.status(403).send("not allowed host.");

    var cacheKey: string = uri + host;
    var cacheFilter: Filter = (function(){
        var ext: string = uri.substring(uri.lastIndexOf(".") + 1);
        /* example.com/123.css?a=1 */
        if(ext.indexOf("?") != -1) ext = ext.substring(0, ext.indexOf("?"));

        var filter = filtersRouter[ext];
        if(filter == null) filter = DefaultFilter

        return new filter(cacheKey, host, req, null);
    })();

   var cache: Buffer = bufferCache.get(cacheKey);

   var processedCache: IProcessedResponse = null;

    if(cache != null) {
        try {
            processedCache = await cacheFilter.onSourceResponseCacheWillBeSent(cache);
        } catch (error) {
            res.status(503).send(`filter error.`);
            console.error(error);
        }
        res.status(200)
            .header({ "x-speed-cache": "hit" })
            .contentType(processedCache.contentType)
            .send(processedCache.content);
        return;
    }

   if(cache == null && processingList[cacheKey] == undefined) {
        processingList[cacheKey] = 1;
        let response: IResponseData = null;
        try {
            response = await tools.requestBuffer("http://" + host + uri, 1024 * 1024 * config.single_cache_limit);
            if(response.statusCode == 200) {
                processedCache = await cacheFilter.onSourceResponseArrive(response, response.content);
            }
        } catch (error) {
            res.status(503).send(`remote server error.`);
            console.error(error);
            delete processingList[cacheKey];
        }

        if(response.statusCode == 200) {
            res.status(response.statusCode)
               .header({ "x-speed-cache": "miss" })
               .contentType(processedCache.contentType)
               .send(processedCache.content);
            bufferCache.put(cacheKey, processedCache.processedContent);
        } else {
            res.status(response.statusCode).contentType(response.contentType).send(response.content);
        }

        delete processingList[cacheKey];
        return;
   }

    res.header({ "x-speed-cache": "source" });
    request("http://" + host + uri).pipe(res);
});

app.use('/', router);

app.listen(config.service_port, function () {
    console.log("http service listen port at", config.service_port);
});