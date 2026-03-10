const MOLTBOOK_BASE_URL = 'https://www.moltbook.com/api/v1'
const CROSSPOST_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes
let lastCrosspostTime = 0

export async function crosspostToMoltbook(post: {
    title: string
    content: string
    tier: string
    tierThreshold: number
    proofHash: string
}): Promise<void> {
    const botApiKey = process.env.MOLTBOOK_BOT_API_KEY
    if (!botApiKey) {
        console.log('[crosspost] No bot API key configured, skipping')
        return
    }

    const now = Date.now()
    if (now - lastCrosspostTime < CROSSPOST_COOLDOWN_MS) {
        console.log(
            '[crosspost] Cooldown active, skipping (next allowed in %ds)',
            Math.ceil(
                (CROSSPOST_COOLDOWN_MS - (now - lastCrosspostTime)) / 1000
            )
        )
        return
    }

    const tierLabel = post.tier.charAt(0).toUpperCase() + post.tier.slice(1)
    const moltbookTitle = `[${tierLabel}] ${post.title}`
    const moltbookContent = `${post.content}\n\n---\nAnonymous post verified by KarmaBridge\nKarma tier: ${tierLabel} (>= ${post.tierThreshold} karma)\nProof: ${post.proofHash.slice(0, 10)}...${post.proofHash.slice(-8)}`

    try {
        const res = await fetch(`${MOLTBOOK_BASE_URL}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${botApiKey}`,
            },
            body: JSON.stringify({
                submolt_name: 'anonbook',
                title: moltbookTitle,
                content: moltbookContent,
                type: 'text',
            }),
        })

        if (res.ok) {
            lastCrosspostTime = Date.now()
        } else {
            const body = await res.json().catch(() => ({}))
            console.error(
                '[crosspost] Moltbook post failed:',
                body.error || res.status
            )
        }
    } catch (err) {
        console.error('[crosspost] Failed to cross-post:', err)
        // Non-fatal: don't fail the anonymous post if cross-posting fails
    }
}
