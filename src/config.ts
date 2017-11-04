interface config {
    service_port: number
    allow_hosts: Array<{
        host: string,
        https: boolean
    }>
    cache_space_limit: number,
    single_cache_limit: number,
}

export default config;