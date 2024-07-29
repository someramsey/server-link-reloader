import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Client, CommandInteraction, GatewayIntentBits, Message, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import "dotenv/config";
import fs from "fs";
import puppeteer from "puppeteer";
import { updateMessageContent } from "./message.js";

type RuntimeData = {
    channelId?: string;
    messageId?: string;
    authToken?: string;
}

let updateInterval: NodeJS.Timeout;
let runtimeData: RuntimeData = loadRuntimeData();

const ALLOWED_USERS = process.env.ALLOWED_USERS.split(",");
const SERVER_CONFIGURE_PAGE = process.env.SERVER_CONFIGURE_PAGE + "/" + process.env.SERVER_ID;
const SERVER_CONFIGURATION_ENDPOINT = process.env.SERVER_CONFIGURATION_ENDPOINT + "/" + process.env.SERVER_ID;

const browser = await puppeteer.launch({ headless: true, userDataDir: process.env.PUPPETEER_USERDATA_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", () => {
    console.log("Discord client ready");

    if (runtimeData.channelId && runtimeData.messageId) {
        fetchUpdateMessage().then(updateMessage => {
            startUpdateInterval();
            update(updateMessage);
        }).catch(error => {
            console.error("Initial fetch for update message failed, error:", error);
        })
    } else {
        console.log("No channel id or message id available, skipping initial update");
    }
});

client.on("interactionCreate", async interaction => {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
        if (interaction.isRepliable()) {
            await interaction.reply({ content: '👎', ephemeral: true });
        }

        return;
    }

    if (interaction.isCommand()) {
        handleCommand(interaction);
    } else if (interaction.isModalSubmit()) {
        handleModal(interaction);
    } else if (interaction.isButton()) {
        handleButton(interaction);
    }
});


client.login(process.env.DISCORD_BOT_TOKEN);

async function handleButton(interaction: ButtonInteraction) {
    switch (interaction.customId) {
        case 'dismiss-alert': {
            interaction.client.channels.fetch(interaction.channelId).then((channel) => {
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return;
                }

                return channel.messages.fetch(interaction.message.id);
            }).then((message) => {
                if (message) {
                    return message.delete();
                }
            }).catch((error) => {
                console.error("Failed to handle dismiss-altert interaction:", error);
            });
        }
    }
}

async function handleModal(interaction: ModalSubmitInteraction) {
    switch (interaction.customId) {
        case 'update-token-modal': {
            runtimeData.authToken = interaction.fields.getTextInputValue("tokenInput");
            saveRuntimeData();

            await interaction.reply({ content: ':man_playing_water_polo::skin-tone-5: ', ephemeral: true });
            console.log("Updated auth token:", runtimeData.authToken);
        } break;
    }
}

async function handleCommand(interaction: CommandInteraction) {
    const { commandName } = interaction;

    switch (commandName) {
        case "init": {
            if (interaction?.channel?.type !== ChannelType.GuildText) {
                await interaction.reply("🙅🏿‍♂️");
                return;
            }

            const updateMessage = await interaction.channel.send("...");

            runtimeData.channelId = interaction.channelId;
            runtimeData.messageId = updateMessage.id;

            saveRuntimeData();

            clearInterval(updateInterval);
            startUpdateInterval();
            update(updateMessage);

            await interaction.deferReply();
            await interaction.deleteReply();

        } break;

        case "update": {
            const favoriteColorInput = new TextInputBuilder()
                .setCustomId('tokenInput')
                .setLabel("Token")
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph);

            const row = new ActionRowBuilder<TextInputBuilder>()
                .addComponents(favoriteColorInput);

            const modal = new ModalBuilder()
                .setCustomId('update-token-modal')
                .setTitle('Modal')
                .addComponents(row);

            await interaction.showModal(modal);
        } break;

        case "trigger": {
            clearInterval(updateInterval);

            fetchUpdateMessage().then(async updateMessage => {
                startUpdateInterval();
                update(updateMessage);

                await interaction.reply({
                    content: "👍",
                    ephemeral: true
                });
            }).catch(async error => {
                console.error("[TRIGGER] Failed to fetch update message, error:", error);

                await interaction.reply({
                    content: "MESAJ YOK 😱😱 \n" + error,
                    ephemeral: true
                });
            });
        } break;

        default: {
            console.error("Unhandled command:", commandName);
        }
    }

}

async function alert(message: string) {
    ALLOWED_USERS.forEach(async alertId => {
        try {
            const user = await client.users.fetch(alertId);

            if (!user) {
                console.log("failed to fetch user for alert, id: '" + alertId + "'");
                return;
            }

            const dismissButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel("👍")
                .setCustomId("dismiss-alert");

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(dismissButton);

            await user.send({
                content: message,
                components: [row]
            });
        } catch (error) {
            console.error("Failed to send alert to user, error:", error);
        }
    });
}

let minorAlertLevel = 0;

async function update(updateMessage: Message) {
    const interrupt = async (cause: string, requiredAlertLevel: number = 0) => {
        if (minorAlertLevel >= requiredAlertLevel) {
            alert(cause);
            clearInterval(updateInterval);

            minorAlertLevel = 0;
            return;
        }

        minorAlertLevel++;
    };

    const navigateSafe = async (url: string): Promise<boolean> => {
        try {
            await page.goto(url);
            return false;
        } catch (error) {
            return true;
        }
    };

    if (!runtimeData.authToken) {
        console.error("Auth token missing");
        interrupt("TOKEN YOK ❌❌ 😭 👎👎");
        return;
    }

    if((await browser.pages()).length > 2) {
        console.error("Invalid state, some pages werent closed, possible corrupted state");
        interrupt("RAMSEYI ÇAĞIIIIR 🙏🙏🙏🙏🙏🙏 🚨🚨🚨\n||Invalid state, some pages werent closed, possible corrupted state||", 2);
        return;
    }

    const page = await browser.newPage();

    try {
        if (await navigateSafe('https://roblox.com')) {
            console.warn("Initial navigation to roblox.com failed");
            return;
        }

        await page.setCookie({ name: ".ROBLOSECURITY", value: runtimeData.authToken, domain: ".roblox.com" });

        if (await navigateSafe(SERVER_CONFIGURE_PAGE) || page.url() !== SERVER_CONFIGURE_PAGE) {
            console.error("Navigation to server page failed, possibly failed to login");
            interrupt("TOKEN BOZUK 👎👎😭 🗣️🔥🔥", 1);
            return;
        }

        const generateButton = await page.waitForSelector("#generate-link-button");

        if (!generateButton) {
            console.error("Selector for generate-link-button failed, possibly failed to load the page");
            interrupt("Ramseyi çağır 🙏🙏 💀❓ 👎👎😭 🗣️🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥", 2);
            return;
        }

        await new Promise<void>(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Failed to update server link generate request timed out");
                interrupt("Ramseyi çağır 🙏🙏 🕒🕒🕒 🚨🚨🚨", 2);
            }, 10000);

            page.on("response", async response => {
                if (response.url() !== SERVER_CONFIGURATION_ENDPOINT || response.request().method() !== "PATCH") {
                    return;
                }

                if (response.status() !== 200) {
                    reject("Failed to update server configuration, generate request failed status code:" + response.status());
                    interrupt("Ramseyi çağır 🙏🙏 😱👆👇☝️👈👉 👎👎👎", 1);
                    return;
                }

                const body = await response.json();

                if (!body.link) {
                    reject("Failed to update server configuration, invalid body:" + JSON.stringify(body));
                    interrupt("Ramseyi çağır 🙏🙏 😱🙅‍♂️");
                    return;
                }
                
                updateMessageContent(body.link, updateMessage)
                clearTimeout(timeout);
                console.log("Updated server link:", body.link);
                resolve();
            });

            await generateButton.click();
        }).catch(console.error);
    } catch (error) {
        console.error("Unhandled Error while updating server link:", error);
        interrupt("RAMSEYI ÇAĞIIIIR 🙏🙏🙏🙏🙏🙏 🚨🚨🚨\n||" + error + "||");
    }

    await page.close();
}

function startUpdateInterval() {
    updateInterval = setInterval(() => {
        fetchUpdateMessage().then(update).catch((error: Error) => {
            clearInterval(updateInterval);
            alert(
                "Mesaj gitti 😱\n" +
                "||" + error.message + "\n" + error.stack + '||'
            );
        });
    }, process.env.DISCORD_BOT_UPDATE_INTERVAL);
}

function fetchUpdateMessage(): Promise<Message> {
    return new Promise((resolve, reject) => {
        if (!runtimeData.channelId) {
            reject("Channel id is missing");
            return;
        }

        client.channels.fetch(runtimeData.channelId).then(channel => {
            if (!channel || channel.type !== ChannelType.GuildText) {
                reject("Invalid channel type");
                return;
            }

            if (!runtimeData.messageId) {
                reject("Message id is missing");
                return;
            }

            return channel.messages.fetch(runtimeData.messageId)
        }).then(message => {
            if (!message) {
                reject("Message not found");
                return;
            }

            resolve(message);
        }).catch(reject);
    });
}

function saveRuntimeData() {
    fs.writeFileSync(process.env.RUNTIME_DATA_PATH, JSON.stringify(runtimeData));
}

function loadRuntimeData(): RuntimeData {
    if (!fs.existsSync(process.env.RUNTIME_DATA_PATH)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(process.env.RUNTIME_DATA_PATH, "utf8"));
}
