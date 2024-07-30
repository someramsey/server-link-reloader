import "dotenv/config";
import "./listener.js";
import fs from "fs";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { updateMessageContent } from "./message.js";
let minorAlertLevel = 0;
let updateInterval;
let runtimeData = loadRuntimeData();
const ALLOWED_USERS = process.env.ALLOWED_USERS.split(",");
const SERVER_CONFIGURATION_ENDPOINT = process.env.SERVER_CONFIGURATION_ENDPOINT + "/" + process.env.SERVER_ID;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.once("ready", () => {
    console.log("Discord client ready");
    if (runtimeData.channelId && runtimeData.messageId) {
        fetchUpdateMessage().then(updateMessage => {
            startUpdateInterval();
            update(updateMessage);
        }).catch(error => {
            console.error("Initial fetch for update message failed, error:", error);
        });
    }
    else {
        console.log("No channel id or message id available, skipping initial update");
    }
});
client.on("interactionCreate", async (interaction) => {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
        if (interaction.isRepliable()) {
            await interaction.reply({ content: '👎', ephemeral: true });
        }
        return;
    }
    if (interaction.isCommand()) {
        handleCommand(interaction);
    }
    else if (interaction.isModalSubmit()) {
        handleModal(interaction);
    }
    else if (interaction.isButton()) {
        handleButton(interaction);
    }
});
client.login(process.env.DISCORD_BOT_TOKEN);
async function handleButton(interaction) {
    switch (interaction.customId) {
        case 'dismiss-alert': {
            interaction.client.channels.fetch(interaction.channelId).then((channel) => {
                if (!channel || !channel.isTextBased()) {
                    console.error("Failed to handle dismiss-alert interaction, invalid channel type");
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
async function handleModal(interaction) {
    switch (interaction.customId) {
        case 'update-token-modal':
            {
                runtimeData.authToken = interaction.fields.getTextInputValue("tokenInput");
                saveRuntimeData();
                await interaction.reply({ content: ':man_playing_water_polo::skin-tone-5: ', ephemeral: true });
                console.log("Updated auth token:", runtimeData.authToken);
            }
            break;
    }
}
async function handleCommand(interaction) {
    const { commandName } = interaction;
    switch (commandName) {
        case "init":
            {
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
            }
            break;
        case "update":
            {
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
                    .addComponents(row);
                await interaction.showModal(modal);
            }
            break;
        case "trigger":
            {
                clearInterval(updateInterval);
                fetchUpdateMessage().then(async (updateMessage) => {
                    startUpdateInterval();
                    update(updateMessage);
                    await interaction.reply({
                        content: "👍",
                        ephemeral: true
                    });
                }).catch(async (error) => {
                    console.error("[TRIGGER] Failed to fetch update message, error:", error);
                    await interaction.reply({
                        content: "MESAJ YOK 😱😱 \n" + error,
                        ephemeral: true
                    });
                });
            }
            break;
        default: {
            console.error("Unhandled command:", commandName);
        }
    }
}
async function update(updateMessage) {
    if (!runtimeData.authToken) {
        console.error("Auth token is missing");
        alert("TOKEN YOK 😱🙅‍♂️🙅‍♂️👎👎👎");
        return;
    }
    const createRequest = () => ({
        method: "PATCH",
        body: JSON.stringify({ newJoinCode: true }),
        headers: {
            'Content-Type': 'application/json',
            'cookie': `.ROBLOSECURITY=${runtimeData.authToken}`,
            'x-csrf-token': runtimeData.csrfToken || ""
        }
    });
    const handleUnexpected = (error) => {
        console.error("Update failed, unexpected error:", error);
        if (minorAlertLevel == 2) {
            minorAlertLevel = 0;
            alert(`RAMSEYI ÇAĞIR 🙏🙏🙏 ❌❌🚨🚨🚨🚨\n||${error}||`);
            return;
        }
        minorAlertLevel++;
    };
    fetch(SERVER_CONFIGURATION_ENDPOINT, createRequest()).then(async (response) => {
        switch (response.status) {
            case 200: return response.json();
            //Unauthorized
            case 401:
                {
                    console.error("Update request failed, response returned Unauthorized, probably due to invalid or outdated token");
                    alert("TOKEN BOZUK YADA SÜRESİ DOLMUŞ 🙅‍♂️🙅‍♂️🙅‍♂️ 🤽🏾‍♂️");
                }
                break;
            //CSRF handshake
            case 403: {
                console.warn("Initial update request returned 403, retrying with new CSRF token");
                const csrf = response.headers.get("x-csrf-token");
                if (!csrf) {
                    console.error("Update request failed, response returned 403 but no CSRF token was provided");
                    alert(`IMKANSIZ BIRŞEKILDE TERS BIŞEYLER TERS DÖNDÜ RAMSEYI ÇAĞIR 🙏🙏🙏 ❌❌🚨🚨🚨🚨\n||${JSON.stringify(response, undefined, 4)}||`);
                    return;
                }
                runtimeData.csrfToken = csrf;
                saveRuntimeData();
                return fetch(SERVER_CONFIGURATION_ENDPOINT, createRequest()).then(response => response.json());
            }
        }
    }).then(body => {
        if (!body?.link) {
            throw new Error("Update request failed, invalid response body:" + JSON.stringify(body, undefined, 4));
        }
        updateMessageContent(body.link, updateMessage);
        console.log("Server link updated successfully: " + body.link);
    }).catch(handleUnexpected);
}
async function alert(message) {
    ALLOWED_USERS.forEach(async (alertId) => {
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
            await user.send({ content: message, components: [row] });
        }
        catch (error) {
            console.error("Failed to send alert to user, error:", error);
        }
    });
}
function startUpdateInterval() {
    updateInterval = setInterval(() => {
        fetchUpdateMessage().then(update).catch((error) => {
            clearInterval(updateInterval);
            alert("Mesaj gitti 😱\n" +
                "||" + error.message + "\n" + error.stack + '||');
        });
    }, process.env.DISCORD_BOT_UPDATE_INTERVAL);
}
function fetchUpdateMessage() {
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
            return channel.messages.fetch(runtimeData.messageId);
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
function loadRuntimeData() {
    if (!fs.existsSync(process.env.RUNTIME_DATA_PATH)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(process.env.RUNTIME_DATA_PATH, "utf8"));
}
