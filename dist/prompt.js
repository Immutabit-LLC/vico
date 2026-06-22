import { createInterface } from "node:readline/promises";
// Prompts go to stderr by default so stdout stays a clean JSON channel.
export async function promptLine(question, input = process.stdin, output = process.stderr) {
    const rl = createInterface({ input, output });
    try {
        const answer = await rl.question(question);
        return answer.trim();
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=prompt.js.map