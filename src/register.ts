import "dotenv/config";
import { REST, Routes, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN as string);
const route = Routes.applicationCommands(process.env.DISCORD_CLIENT_ID as string);

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
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