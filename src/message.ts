import { Message } from "discord.js";

const content = (link: string, channel: string) => 
`| - - - | **About of Server** | - - - |

You can now successfully join the server ^^
Here is the link;
[<${link}>]

Dont forget, this vip server is for farming
**NOT FOR CHEATING**

*If you see someone not following the rules, you can report them at ${channel}*`;

export function updateMessageContent(link: string, message: Message) {
    const reportChannel = message.guild?.channels.cache.get('1255292239605796985');
    
    if(!reportChannel) {
        console.error("report channel not found");
        message.edit("failed");
        return;
    }

    message.edit(content(link, reportChannel.toString()));
}