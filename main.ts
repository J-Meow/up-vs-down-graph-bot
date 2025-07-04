import { LogLevel, ReactionAddedEvent, WebClient } from "npm:@slack/web-api"
import { SocketModeClient } from "npm:@slack/socket-mode"
import "jsr:@std/dotenv/load"
import { createCanvas } from "https://deno.land/x/canvas/mod.ts"

let data: number[] = []

function getGraph(data: number[]) {
    const canvas = createCanvas(1600, 900)
    const ctx = canvas.getContext("2d")

    ctx.fillStyle = "#f88"
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2)
    ctx.fillStyle = "#88f"
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2)

    ctx.strokeStyle = "#555"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    ctx.strokeStyle = "#000"
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(-10, canvas.height / 2)
    for (let i = 0; i < data.length; i++) {
        const point = data[i]
        ctx.lineTo((canvas.width / (data.length - 1)) * i, canvas.height / 2 - point * (canvas.height / 200))
    }
    ctx.stroke()

    return canvas.toBuffer("image/png")
}

const client = new WebClient(Deno.env.get("OAUTH_TOKEN"), {
    logLevel: LogLevel.INFO,
})

const channelId = Deno.env.get("SLACK_CHANNEL_ID")!

const socketClient = new SocketModeClient({ appToken: Deno.env.get("SOCKET_TOKEN")!, logLevel: LogLevel.INFO })

const messages: { [key: string]: string } = {}

const recievedEvents: string[] = []

socketClient.on("reaction_added", async (ev) => {
    const event = ev.event as ReactionAddedEvent
    if (recievedEvents.includes(event.event_ts)) {
        return
    }
    recievedEvents.push(event.event_ts)
    setTimeout(() => {
        recievedEvents.splice(recievedEvents.indexOf(event.event_ts), 1)
    }, 120000)
    if (event.item.type == "message") {
        if (event.item.channel == channelId) {
            if (event.user == Deno.env.get("RTM_BOT_ID")!) {
                if (event.reaction == "white_check_mark") {
                    const ts = event.item.ts
                    const text = messages[ts]!
                    if (text && !isNaN(parseInt(text)) && Math.abs(parseInt(text)) < 100) {
                        data.push(parseInt(text))
                        console.log(parseInt(text))
                        delete messages[ts]
                    }
                }
                if (event.reaction == "tada" && data.length > 0) {
                    const ts = event.item.ts
                    const text = messages[ts]!
                    console.log("Game end")
                    data.push(parseInt(text))
                    await sendGraph(getGraph(data))
                    data = []
                    console.log("Game end message sent")
                }
            }
        }
    }
})
socketClient.on("message", (ev) => {
    const event = ev.event
    messages[event.ts] = event.text
    setTimeout(() => {
        if (event.ts in messages) {
            delete messages[event.ts]
        }
    }, 60000)
})
await socketClient.start()

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
// await sendGraph(
//     getGraph([
//         0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0, -1, -2, -1, -2, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
//         84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 94, 95, 96, 97, 98, 99, 100,
//     ])
// )
