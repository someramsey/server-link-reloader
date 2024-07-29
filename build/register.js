import "dotenv/config";
import { REST, Routes } from 'discord.js';
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);
const route = Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
const commands = [
    {
        name: 'init',
        description: 'init'
    },
    {
        name: 'update',
        description: 'update'
    },
    {
        name: 'trigger',
        description: 'trigger'
    }
];
rest.put(route, { body: commands })
    .then(() => console.log("Successfully registered application commands"))
    .catch(console.error);
