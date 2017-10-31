
class LRUCacheNode<T> {

    private lastAccessTime: number = 0;

    private lastNode: LRUCacheNode<T> = null;
    private nextNode: LRUCacheNode<T> = null;

    constructor(private key: string, private value: T) {
        this.updateLastAccessTime();
    }

    public updateLastAccessTime(): LRUCacheNode<T> {
        this.lastAccessTime = Math.floor(new Date().getTime() / 1000);
        return this;
    }
    
    public getKey(): string {
        return this.key;
    }

    public getValue(): T {
        return this.value;
    }

    public getLastNode(): LRUCacheNode<T>{
        return this.lastNode;
    }

    public getNextNode(): LRUCacheNode<T>{
        return this.nextNode;
    }

    public setLastNode(node: LRUCacheNode<T>): LRUCacheNode<T> {
        this.lastNode = node;
        return this;
    }

    public setNextNode(node: LRUCacheNode<T>): LRUCacheNode<T> {
        this.nextNode = node;
        return this;
    }

    public isLastNode() {
        return this.nextNode == null;
    }

    public isFirstNode() {
        return this.lastNode == null;
    }
}

export default class LRUBufferCache {

    private cacheCounter: number = 0;
    private cacheUsedSpace: number = 0;
    private cacheElementsSpaceLimit: number = 0;

    private firstCache: LRUCacheNode<Buffer>;
    private lastCache: LRUCacheNode<Buffer>;
    private cacheHashContainer: { [key:string]: LRUCacheNode<Buffer> } = {};

    constructor(cacheElementsSpaceLimit: number) {
        this.setCacheElementsSpaceLimit(cacheElementsSpaceLimit);
    }

    public get(key: string): Buffer {
        var cache = this.cacheHashContainer[key];
        if(cache == undefined) return null;
        if(cache.isFirstNode()) return cache.getValue();
        
        if(cache.isLastNode()) {
            var newLastNode = cache.getLastNode();
            newLastNode.setNextNode(null);
        } else {
            cache.getLastNode().setNextNode(cache.getNextNode());
        }

        cache.setNextNode(this.firstCache);
        this.firstCache.setLastNode(cache);
        this.firstCache = cache;

        return cache.getValue();
    }

    public put(key: string, val: Buffer): boolean {
        if(this.get(key) != null) return false;

        var cache: LRUCacheNode<Buffer> = new LRUCacheNode(key, val);

        if (this.cacheCounter == 0) {
            this.firstCache = cache;
            this.lastCache = cache;
        } else {
            this.firstCache.setLastNode(cache);
            cache.setNextNode(this.firstCache);
            this.firstCache = cache;
        }
        this.cacheCounter++;
        this.cacheUsedSpace += val.length;
        this.cacheHashContainer[key] = cache;

        this.gc();

        return true;
    }

    gc() {
        if(!(this.cacheUsedSpace > this.cacheElementsSpaceLimit)) return;
        var lastCache = this.lastCache;
        var newLastCache = lastCache.getLastNode();
        lastCache.setLastNode(null);
        newLastCache.setNextNode(null);
        delete this.cacheHashContainer[lastCache.getKey()];
        this.lastCache = newLastCache;
        this.cacheCounter--;
        this.cacheUsedSpace -= lastCache.getValue().length;
        this.gc();
    }

    getCacheElementsCount(): number {
        return this.cacheCounter;
    }

    getCacheUsedSpace(): number {
        return this.cacheUsedSpace;
    }

    setCacheElementsSpaceLimit(cacheElementsSpaceLimit: number): LRUBufferCache {
        if (cacheElementsSpaceLimit <= 0) {
            throw new Error("Invalid cache size for LRUCache.");
        }
        this.cacheElementsSpaceLimit = cacheElementsSpaceLimit;
        return this;
    }
}