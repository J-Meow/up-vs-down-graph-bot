import { LogLevel, WebClient } from "npm:@slack/web-api"
import "jsr:@std/dotenv/load"

const client = new WebClient(Deno.env.get("OAUTH_TOKEN"), {
    logLevel: LogLevel.DEBUG,
})

const channelId = Deno.env.get("SLACK_CHANNEL_ID")!

client.chat.postEphemeral({
    user: Deno.env.get("ALERT_USER_ID")!,
    attachments: [],
    channel: channelId,
    blocks: [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `\`Bot started\``,
            },
        },
    ],
})
