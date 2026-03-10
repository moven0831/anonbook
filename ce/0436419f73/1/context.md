# Session Context

## User Prompts

### Prompt 1

list out the proper setup and e2e flow (with commands)

### Prompt 2

the port is actually different\
"""\
❯ REDACTED KARMA_BRIDGE_ADDRESS=0x9A676e781A523b5d0C0e43731313A708CB607508 yarn relay start
Listening: http://127.0.0.1:8000\
"""

### Prompt 3

yes

### Prompt 4

got this error after the relay started\
"""\
❯ curl -X POST http://127.0.0.1:8000/api/signup \
    -H "Content-Type: application/json" \
    -d '{"moltbookApiKey": "YOUR_TEST_AGENT_KEY"}'
{"error":{}}%                                                                     
❯ curl -X POST http://127.0.0.1:8000/api/signup \
    -H "Content-Type: application/json" \
    -d '{"moltbookApiKey": "Ysdfnlenfafe"}'
{"error":{}}% \
"""

### Prompt 5

make the relay endpoint port at 3000, adapt all of the related part.\
\
Including this one\
"""\
❯ npx tsx src/index.tsx
anonbook                                                                            live

Cannot reach relay at http://localhost:3000
─────────────────────────────────────────────
Filter: [a]ll [l]egend [t]rusted [c]ontributor [n]ewcomer
[q]uit posts: 0


\
"""

