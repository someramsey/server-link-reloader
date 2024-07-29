import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import "dotenv/config";
import fs from "fs";
// import puppeteer from "puppeteer"; //TODO: enable
import { buildMessageContent } from "./message.js";

let updateInterval;
let runtimeData = loadRuntimeData();

const ALLOWED_USERS = process.env.ALLOWED_USERS.split(",");
const SERVER_CONFIGURE_PAGE = process.env.SERVER_CONFIGURE_PAGE + "/" + process.env.SERVER_ID;
const SERVER_CONFIGURATION_ENDPOINT = process.env.SERVER_CONFIGURATION_ENDPOINT + "/" + process.env.SERVER_ID;

//TODO: enable
// const browser = await puppeteer.launch({ headless: true, userDataDir: process.env.PUPPETEER_USERDATA_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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
        await interaction.reply({ content: '👎', ephemeral: true });
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

async function handleButton(interaction) {
    switch (interaction.customId) {
        case 'dismiss-alert': {
            const channel = await interaction.client.channels.fetch(interaction.channelId);
            const message = await channel.messages.fetch(interaction.message.id);

            await message.delete();
        }
    }
}

async function handleModal(interaction) {
    switch (interaction.customId) {
        case 'update-token-modal': {
            runtimeData.authToken = interaction.fields.getTextInputValue("tokenInput");
            saveRuntimeData();
            console.log("Updated auth token:", runtimeData.authToken);

            await interaction.reply({ content: ':man_playing_water_polo::skin-tone-5: ', ephemeral: true });
        } break;
    }
}

async function handleCommand(interaction) {
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

            const row = new ActionRowBuilder()
                .addComponents(favoriteColorInput);

            const modal = new ModalBuilder()
                .setCustomId('update-token-modal')
                .setTitle('Modal')
                .addComponents(row)

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

async function alert(message) {
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

            const row = new ActionRowBuilder()
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

async function update(updateMessage) {
    if (!runtimeData.authToken) {
        console.error("No auth token available");
        alert("TOKEN ❌❌ 😭 👎👎");
        clearInterval(updateInterval);
        return;
    }

    return; //TODO: remove
    const page = await browser.newPage();

    try {
        let navigated = false;

        try {
            await page.goto('https://roblox.com');
            navigated = true;
        } catch(error) {
            console.warn(error);
        }

        if(!navigated) {
            return;
        }

        await page.setCookie({ "name": ".ROBLOSECURITY", "value": runtimeData.authToken, "domain": ".roblox.com", "session": false });

        await page.goto(SERVER_CONFIGURE_PAGE);

        if (page.url() !== SERVER_CONFIGURE_PAGE) {
            console.error("Failed to login using token, unexpected page url:", page.url());
            alert("TOKEN BOZUK 👎👎😭 🗣️🔥🔥");
            clearInterval(updateInterval);
            page.close();
            return;
        }

        const generateButton = await page.waitForSelector("#generate-link-button");

        if (!generateButton) {
            console.error("Selector for generate button failed, possible corrupted state");

            if (minorAlertLevel >= 1) {
                alert("Ramseyi çağır 🙏🙏 💀❓ 👎👎😭 🗣️🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥");
                clearInterval(updateInterval);
                minorAlertLevel = 0;
                page.close();
                return;
            }

            minorAlertLevel++;
            page.close();
            return;
        }

        page.on("response", async response => {
            if (response.url() == SERVER_CONFIGURATION_ENDPOINT) {
                if (response.request().method() !== "PATCH") {
                    return;
                }

                if (response.status() !== 200) {
                    console.error("Failed to update server configuration, generate request failed status code:", response.status());

                    if (minorAlertLevel >= 3) {
                        alert("Ramseyi çağır 🙏🙏 😱👆👇☝️👈👉 👎👎👎");
                        clearInterval(updateInterval);
                        minorAlertLevel = 0;
                        page.close();
                        return;
                    }

                    minorAlertLevel++;
                    page.close();
                    return;
                }


                const body = await response.json();

                if (!body.link) {
                    console.log("Failed to update server configuration, invalid body:", body);

                    if (minorAlertLevel >= 3) {
                        alert("İşi batırdım, ramseyi çağır 🙏🙏 😱🙅‍♂️");
                        clearInterval(updateInterval);
                        minorAlertLevel = 0;
                        page.close();
                        return;
                    }

                    minorAlertLevel++;
                    page.close();
                    return;
                }


                minorAlertLevel = 0;

                const messageContent = buildMessageContent(body.link, updateMessage.guild.channels.cache.get('1255292239605796985').toString());
                updateMessage.edit(messageContent);

                console.log("Updated server link:", body.link);
                page.close();
            }
        })

        await generateButton.click();
    } catch (error) {
        console.error("Failed to update server link unhandled error:", error);
        alert("RAMSEYI ÇAĞIIIIR 🙏🙏🙏🙏🙏🙏 🚨🚨🚨\n||" + error + "||");
        clearInterval(updateInterval);
        page.close();
    }
}

function startUpdateInterval() {
    updateInterval = setInterval(() => {
        fetchUpdateMessage().then(updateMessage => {
            update(updateMessage);
        }).catch(error => {
            console.error("[Interval] Failed to fetch update message, error:", error);
            clearInterval(updateInterval);
            alert("Mesaj gitti 😱\n||`" + error + '||');
        });
    }, process.env.DISCORD_BOT_UPDATE_INTERVAL);
}

function fetchUpdateMessage() {
    return new Promise((resolve, reject) => {
        client.channels.fetch(runtimeData.channelId).then(channel => {
            channel.messages.fetch(runtimeData.messageId).then(message => {
                resolve(message);
            }).catch(reject);
        }).catch(reject);
    });
}

function saveRuntimeData() {
    fs.writeFileSync(process.env.RUNTIME_DATA_PATH, JSON.stringify(runtimeData));
}

function loadRuntimeData() {
    if (!fs.existsSync(process.env.RUNTIME_DATA_PATH)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(process.env.RUNTIME_DATA_PATH));
}
