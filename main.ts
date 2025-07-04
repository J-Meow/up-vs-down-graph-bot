import { LogLevel, WebClient } from "npm:@slack/web-api"
import "jsr:@std/dotenv/load"
import { createCanvas } from "https://deno.land/x/canvas/mod.ts"

function getGraph(/* Real data coming soon */) {
    const canvas = createCanvas(1600, 900)
    const ctx = canvas.getContext("2d")

    ctx.fillStyle = "red"
    ctx.fillRect(10, 10, 10, 10)

    return canvas.toBuffer("image/png")
}

const client = new WebClient(Deno.env.get("OAUTH_TOKEN"), {
    logLevel: LogLevel.DEBUG,
})

const channelId = Deno.env.get("SLACK_CHANNEL_ID")!

// client.chat.postEphemeral({
//     user: Deno.env.get("ALERT_USER_ID")!,
//     attachments: [],
//     channel: channelId,
//     blocks: [
//         {
//             type: "section",
//             text: {
//                 type: "mrkdwn",
//                 text: `\`Bot started\``,
//             },
//         },
//     ],
// })

async function sendGraph(buffer: Uint8Array) {
    const uploadResponse = await client.files.getUploadURLExternal({ filename: "graph.png", length: buffer.byteLength, alt_text: "Graph of up vs. down game" })
    console.log(uploadResponse)
    if (!uploadResponse.ok) {
        console.error(uploadResponse.error)
    }
    const fileId = uploadResponse.file_id!
    const uploadURL = uploadResponse.upload_url!
    await fetch(uploadURL, {
        method: "POST",
        body: buffer,
    })
    const completeUploadResponse = await client.files.completeUploadExternal({
        files: [{ id: fileId, title: "Graph" }],
        channel_id: channelId,
        blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Good job, everyone!* Here's a graph of the game.` } }],
    })
    if (!completeUploadResponse.ok) {
        console.error(completeUploadResponse.error)
    }
}
await sendGraph(getGraph())
