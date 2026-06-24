const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/carlo/.gemini/antigravity/brain/d3c64dea-36a9-4b8d-9b02-29dc65352077/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'CODE_ACTION' || data.type === 'PLANNER_RESPONSE' || data.type === 'ACTION_RESULT') {
          if (JSON.stringify(data).includes('mensajes.js')) {
             console.log(`Found mention at step ${data.step_index}`);
             if (data.content) console.log(data.content.substring(0, 500));
          }
      }
    } catch (e) {}
  }
}

processLineByLine();
