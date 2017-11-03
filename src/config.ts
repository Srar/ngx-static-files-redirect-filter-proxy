interface config {
    service_port: number
    allow_hosts: Array<string>
    cache_space_limit: number,
    single_cache_limit: number,
    source_https_protocol: boolean
}

export default config;