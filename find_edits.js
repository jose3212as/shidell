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
      if (data.tool_calls) {
        for (const tc of data.tool_calls) {
          if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && 
              tc.args.TargetFile && tc.args.TargetFile.includes('mensajes.js')) {
            console.log(`Found edit at step ${data.step_index}:`);
            console.log('Instruction:', tc.args.Instruction);
            if (tc.args.ReplacementChunks) {
                tc.args.ReplacementChunks.forEach((chunk, idx) => {
                    console.log(`Chunk ${idx}: TargetContent:`, chunk.TargetContent);
                    console.log(`Chunk ${idx}: ReplacementContent:`, chunk.ReplacementContent);
                });
            } else {
                console.log('TargetContent:', tc.args.TargetContent);
                console.log('ReplacementContent:', tc.args.ReplacementContent);
            }
            console.log('---');
          }
        }
      }
    } catch (e) {}
  }
}

processLineByLine();
