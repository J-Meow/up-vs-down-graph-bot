import { LogLevel, WebClient } from "npm:@slack/web-api"
import "jsr:@std/dotenv/load"
import { createCanvas } from "https://deno.land/x/canvas/mod.ts"

let data: number[] = []
let mistakes = 0
let upParticipated = false
let downParticipated = false
let lastUser = ""

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

client.chat.postEphemeral({
    user: Deno.env.get("ALERT_USER_ID")!,
    attachments: [],
    channel: channelId,
    text: "Bot started",
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
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Good job, everyone!* ${
                        Math.abs(data[0]) <= 1
                            ? "Here's a graph of the game." + (upParticipated && !downParticipated ? " Wow, only Team Up participated in that game." : "") + (downParticipated && !upParticipated ? " Wow, only Team Down participated in that game." : "") + (mistakes ? "" : " And congratulations, you made no mistakes!")
                            : `I missed the beginning of this game, but here's a graph starting from ${data[0]}.`
                    }`,
                },
            },
        ],
    })
    if (!completeUploadResponse.ok) {
        console.error(completeUploadResponse.error)
    }
}
function startSocket() {
    const socket = new WebSocket(Deno.env.get("EVENTS_WS_URL")!)

    socket.onopen = () => {
        console.log(socket.readyState)
    }

    socket.onmessage = async (event) => {
        const json = JSON.parse(event.data)
        if (json.user == lastUser) return
        console.log(event.data)
        if (json["user-team"] == "UP") {
            upParticipated = true
        }
        if (json["user-team"] == "DOWN") {
            downParticipated = true
        }
        if (json.type == "count" || json.type == "screwed-up") {
            if (Math.abs(json.resultingCount) < 100) {
                data.push(json.resultingCount)
            }
        }
        if (json.type == "screwed-up") {
            mistakes++
        }
        lastUser = json.user
        if (json.type == "win" || Math.abs(json.resultingCount) >= 100) {
            await sendGraph(getGraph(data))
            data = []
            mistakes = 0
            upParticipated = false
            downParticipated = false
            lastUser = ""
        }
    }
    const interval = setInterval(() => {
        if (socket.readyState !== socket.OPEN) return
        socket.send(new Uint8Array([0]))
    }, 10000)

    socket.addEventListener("close", () => {
        clearInterval(interval)
        socket.onmessage = () => {}
        socket.onopen = () => {}
        socket.close()
        startSocket()
    })
    socket.addEventListener("error", () => {
        clearInterval(interval)
        socket.onmessage = () => {}
        socket.onopen = () => {}
        socket.close()
        startSocket()
    })
}
startSocket()
