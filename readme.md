# ngx-static-files-redirect-filter-proxy

[ngx-static-files-redirect-filter](https://github.com/Srar/ngx-static-files-redirect-filter)配套转发Proxy.

## 已实现功能

* LRU内存缓存
* CSS内引用资源重定向
* 图片自动转码为WebP并发送给支持的浏览器

## 配置文件

```json
{	
    "service_port": 5000,
    "allow_hosts": [
        "127.0.0.1:3000"
    ],
    "redirect_domain": "http://127.0.0.1:5000/",
    "cache_space_limit": 128,
    "single_cache_limit": 5,
    "source_https_protocol": false
}
```

* `service_port`: 服务监听的端口号.
* `allow_hosts`: 允许转发的host列表.
* `redirect_domain`: 当前服务所绑定的域名, 如有多个请选定一个.
* `cache_space_limit`: 内存缓存大小上限. 单位MB.
* `single_cache_limit`: 单个资源大小最大上限. 单位MB.
* `source_https_protocol`: 源站是否使用了HTTPS.

## Nginx配置

```nginx
server {
    listen      3000;
    server_name  _;

    proxy_buffering on;
    proxy_buffer_size 4k; 
    proxy_buffers 8 1M;
    proxy_busy_buffers_size 2M;
    proxy_max_temp_file_size 0;

    location / {
        proxy_pass                                      http://example.com/;
        proxy_set_header                                Host "example.com";
        static_redirect                                 on;
        static_redirect_new_host                        "http://127.0.0.1:5000/";
        static_redirect_new_host_ramdom                 0 1;
        static_redirect_take_src_requesting_path        on;
        static_redirect_base64_src_host                 on;
        static_redirect_base64_src_url                  on;
        static_redirect_base64_src_requesting_path      on;
        static_redirect_split_tag                       "/";
    }
}
```

