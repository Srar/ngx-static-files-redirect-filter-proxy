# ngx-static-files-redirect-filter-proxy

[ngx-static-files-redirect-filter](https://github.com/Srar/ngx-static-files-redirect-filter)配套转发Proxy.

## 已实现功能

* LRU内存缓存
* CSS内引用资源重定向
* 图片自动转码为WebP并发送给支持的浏览器(由于v8 GC导致内存问题暂时禁用)

## 配置文件

```json
{
    "service_port": 8443,
    "allow_hosts": [
        {
            "host": "example.com",
            "https": true
        }
    ],
    "accept_unauthorized_cert": false,
    "redirect_domain": "https://static.example.com:8443/",
    "cache_space_limit": 300,
    "single_cache_limit": 5
}
```

* `service_port`: 服务监听的端口号.
* `allow_hosts`: 允许转发的host列表.
* `redirect_domain`: 当前服务所绑定的域名, 如有多个请选定一个.
* `cache_space_limit`: 内存缓存大小上限. 单位MB.
* `single_cache_limit`: 单个资源大小最大上限. 单位MB.
* `accept_unauthorized_cert`: 是否接受证书验证错误的请求.

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
        static_redirect_new_host                        "https://static.example.com:8443/?url=";
        static_redirect_new_host_ramdom                 0 1;
        static_redirect_take_src_requesting_path        on;
        static_redirect_base64_src_host                 on;
        static_redirect_base64_src_url                  on;
        static_redirect_base64_src_requesting_path      on;
        static_redirect_split_tag                       ":";
    }
}
```

## 操作 - 刷新缓存

浏览器中访问: `http://ip:port/flush`. 将已重写的URL填入文本框点击`flush`按钮.

## 操作 - 缓存概况

浏览器中访问: `http://ip:port/status`.

* `total`: 缓存总大小上限.
* `used`: 已使用的缓存大小.
* `free`: 可使用的缓存大小.
* `elements count`: 已缓存的资源数量.