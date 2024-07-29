namespace NodeJS {
    interface ProcessEnv { 
        readonly RUNTIME_DATA_PATH: string
        readonly PUPPETEER_USERDATA_PATH: string

        readonly SERVER_CONFIGURE_PAGE: string
        readonly SERVER_CONFIGURATION_ENDPOINT: string
        readonly SERVER_ID: string

        readonly DISCORD_CLIENT_ID: string
        readonly DISCORD_BOT_TOKEN: string
        readonly DISCORD_BOT_UPDATE_INTERVAL: number

        readonly ALLOWED_USERS: string
    }
}